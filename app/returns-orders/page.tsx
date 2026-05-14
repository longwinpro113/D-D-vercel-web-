"use client";

import React, { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import axios from "axios";
import { entrySizes, sizeToCol } from "@/lib/size";
import { useSharedReportClient } from "@/lib/useSharedReportClient";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import { Snackbar, Alert } from "@mui/material";
import { ChevronDown } from "lucide-react";

type ReturnReportRow = {
    id: string | number;
    ry_number: string;
    received_date?: string;
    note?: string | null;
    shipping_round?: number | null;
    total_received?: number | null;
    [key: string]: any;
};

const autocompletePopupIcon = <ChevronDown size={16} />;

export default function ReturnsOrdersPage() {
    const [sharedClient, setSharedClient] = useSharedReportClient();
    const [client, setClient] = useState<string | undefined>(sharedClient || "");
    const [clients, setClients] = useState<string[]>([]);
    const [rows, setRows] = useState<ReturnReportRow[]>([]);
    const [orderRyFilter, setOrderRyFilter] = useState("");
    const [snackbar, setSnackbar] = useState<{
        open: boolean;
        message: string;
        severity: "success" | "error" | "info" | "warning";
    }>({
        open: false,
        message: "",
        severity: "success",
    });

    const isMounted = useSyncExternalStore(
        () => () => { },
        () => true,
        () => false
    );

    const handleCloseSnackbar = (_?: React.SyntheticEvent | Event, reason?: string) => {
        if (reason === "clickaway") return;
        setSnackbar(prev => ({ ...prev, open: false }));
    };

    useEffect(() => {
        const loadClients = async () => {
            try {
                const res = await axios.get("/api/returns/clients");
                const list = Array.isArray(res.data) ? (res.data as string[]) : [];
                setClients(list);
                if (!client && list.length > 0) {
                    setClient(list[0]);
                    setSharedClient(list[0]);
                }
            } catch (err) {
                console.error("[API] Load clients error:", err);
            }
        };
        void loadClients();
    }, [setSharedClient, client]);

    const fetchRows = useCallback(async () => {
        if (!client) {
            setRows([]);
            return;
        }

        try {
            const params: Record<string, string> = { client };
            const res = await axios.get("/api/returns/received", { params });
            setRows(Array.isArray(res.data) ? (res.data as ReturnReportRow[]) : []);
        } catch (err) {
            console.error("[API] Fetch returns error:", err);
            setRows([]);
        }
    }, [client]);

    useEffect(() => {
        void fetchRows();
    }, [fetchRows]);

    const filteredRows = useMemo(() => {
        if (!orderRyFilter) return rows;
        const search = orderRyFilter.toLowerCase();
        return rows.filter(r => (r.ry_number || "").toLowerCase().includes(search));
    }, [rows, orderRyFilter]);

    const grouped = useMemo(() => {
        const map = new Map<string, ReturnReportRow[]>();
        filteredRows.forEach(row => {
            const date = row.received_date || "Unknown";
            if (!map.has(date)) map.set(date, []);
            map.get(date)!.push(row);
        });
        return Array.from(map.entries()).map(([date, rows]) => ({ date, rows }));
    }, [filteredRows]);

    if (!isMounted) return null;

    return (
        <div className="mx-auto flex h-[calc(100dvh-80px)] min-h-[calc(100dvh-80px)] w-full flex-col gap-4 p-4 lg:p-6 overflow-hidden bg-slate-50 text-[14px]">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex-1 flex flex-col min-h-0">
                <div className="flex justify-between items-start mb-6 shrink-0">
                    <div>
                        <h1 className="text-lg font-bold uppercase text-slate-800 tracking-wide">
                            Đơn Hàng Trả Sửa (Khách Trả Về)
                        </h1>
                        <p className="text-sm text-slate-400 mt-1">
                            Xem chi tiết các đơn hàng khách hàng đã trả về sửa
                        </p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 mb-4 shrink-0 items-center">
                    <Autocomplete
                        options={clients}
                        value={(client || null) as any}
                        disableClearable
                        popupIcon={autocompletePopupIcon}
                        forcePopupIcon={true}
                        onChange={(_, newValue) => {
                            if (newValue) {
                                setClient(newValue);
                                setSharedClient(newValue);
                            }
                        }}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                placeholder="Khách hàng"
                                variant="outlined"
                                sx={{
                                    "& .MuiOutlinedInput-root": {
                                        height: "42px",
                                        borderRadius: "12px",
                                        backgroundColor: "white",
                                        "& fieldset": { borderColor: "#e2e8f0" },
                                        "&.Mui-focused fieldset": { borderColor: "#000" },
                                    }
                                }}
                            />
                        )}
                        sx={{ width: "240px" }}
                    />

                    <TextField
                        placeholder="Mã đơn hàng..."
                        variant="outlined"
                        value={orderRyFilter}
                        onChange={(e) => setOrderRyFilter(e.target.value)}
                        sx={{
                            width: "240px",
                            "& .MuiOutlinedInput-root": {
                                height: "42px",
                                borderRadius: "12px",
                                backgroundColor: "white",
                                "& fieldset": { borderColor: "#e2e8f0" },
                                "&.Mui-focused fieldset": { borderColor: "#000" },
                            }
                        }}
                    />
                </div>

                <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto rounded-xl border border-slate-200 report-scrollbar">
                    <table className="border-separate border-spacing-0 text-[13px] w-max min-w-full table-auto">
                        <thead className="sticky top-0 z-40 bg-slate-100">
                            <tr>
                                <th className="sticky left-0 z-50 bg-slate-100 shadow-[inset_-1px_-1px_0_0_#e2e8f0] px-2 py-3 text-center font-bold text-slate-700 w-12">STT</th>
                                <th className="sticky left-[48px] z-50 bg-slate-100 shadow-[inset_-1px_-1px_0_0_#e2e8f0] px-3 py-3 text-center font-bold text-slate-700 whitespace-nowrap">Đơn Hàng</th>
                                <th className="px-4 py-3 text-center font-bold text-slate-700 whitespace-nowrap border-b border-slate-200">Lô</th>
                                <th className="px-4 py-3 text-center font-bold text-slate-700 whitespace-nowrap border-b border-slate-200">Article</th>
                                <th className="px-4 py-3 text-center font-bold text-slate-700 whitespace-nowrap border-b border-slate-200">Model Name</th>
                                <th className="px-4 py-3 text-center font-bold text-slate-700 whitespace-nowrap border-b border-slate-200">CRD</th>
                                <th className="px-4 py-3 text-center font-bold text-slate-700 whitespace-nowrap border-b border-slate-200">Product</th>
                                <th className="px-4 py-3 text-center font-bold text-slate-700 whitespace-nowrap border-b border-slate-200">SL Nhận</th>
                                <th className="px-4 py-3 text-center font-bold text-slate-700 whitespace-nowrap border-b border-slate-200">SL Trả</th>
                                <th className="px-4 py-3 text-center font-bold text-rose-700 whitespace-nowrap border-b border-slate-200 bg-rose-50">Số dư Lô</th>
                                {entrySizes.map((s) => (
                                    <th key={s} className="border-b border-r border-slate-200 px-1 py-3 text-center font-bold text-slate-800 w-11">{s}</th>
                                ))}
                                <th className="px-4 py-3 text-center font-bold text-slate-700 border-b border-slate-200">Ghi Chú</th>
                            </tr>
                        </thead>
                        <tbody>
                            {grouped.map((group) => (
                                <React.Fragment key={group.date}>
                                    <tr>
                                        <td className="sticky left-0 z-30 bg-[#f8fafc] border-b border-slate-100 h-10 shadow-[inset_-1px_0_0_0_#e2e8f0]"></td>
                                        <td className="sticky left-[48px] z-30 bg-[#f8fafc] border-b border-slate-100 h-10 shadow-[inset_-1px_0_0_0_#e2e8f0] px-3 py-2 text-center font-bold text-blue-600 uppercase tracking-wider whitespace-nowrap">
                                            {group.date}
                                        </td>
                                        <td colSpan={8 + entrySizes.length} className="bg-[#f8fafc] border-b border-slate-100 px-4 py-2"></td>
                                    </tr>
                                    {group.rows.map((row, index) => {
                                        const rowBg = index % 2 === 0 ? "bg-white" : "bg-slate-50";
                                        return (
                                            <tr key={row.id} className={`${rowBg} hover:bg-blue-50/20 transition-colors group`}>
                                                <td className={`sticky left-0 z-10 shadow-[inset_-1px_-1px_0_0_#e2e8f0] px-3 py-2.5 font-bold text-slate-800 text-center whitespace-nowrap ${rowBg} group-hover:bg-blue-50`}>
                                                    {index + 1}
                                                </td>
                                                <td className={`sticky left-[48px] z-10 shadow-[inset_-1px_-1px_0_0_#e2e8f0] px-3 py-2.5 font-bold text-slate-900 text-center whitespace-nowrap ${rowBg} group-hover:bg-blue-50`}>
                                                    {row.ry_number}
                                                </td>
                                                <td className="border-b border-r border-slate-100 px-3 py-2.5 font-bold text-orange-600 text-center whitespace-nowrap">Lô {row.shipping_round}</td>
                                                <td className="border-b border-r border-slate-100 px-3 py-2.5 font-bold text-[#e59f67] text-center whitespace-nowrap">{row.article || "-"}</td>
                                                <td className="border-b border-r border-slate-100 px-3 py-2.5 font-bold text-[#e59f67] text-center whitespace-nowrap">{row.model_name || "-"}</td>
                                                <td className="border-b border-r border-slate-100 px-3 py-2.5 font-bold text-blue-600 text-center whitespace-nowrap">{row.CRD || "-"}</td>
                                                <td className="border-b border-r border-slate-100 px-3 py-2.5 font-bold text-[#e59f67] text-center whitespace-nowrap">{row.product || "-"}</td>
                                                <td className="border-b border-r border-slate-100 px-3 py-2.5 font-bold text-[#0284c7] text-center whitespace-nowrap">
                                                    {row.total_received}
                                                </td>
                                                <td className="border-b border-r border-slate-100 px-3 py-2.5 font-bold text-[#0284c7] text-center whitespace-nowrap">
                                                    {row.total_shipped}
                                                </td>
                                                <td className={`border-b border-r border-slate-100 px-3 py-2.5 font-bold text-center whitespace-nowrap ${row.lot_balance === 0 ? "text-emerald-600 bg-emerald-50/20" : "text-rose-600 bg-rose-50/20"}`}>
                                                    {row.lot_balance === 0 ? "Xong" : row.lot_balance}
                                                </td>
                                                {entrySizes.map((s) => {
                                                    const val = row[`s${String(s).replace(".", "_")}`];
                                                    const isEmpty = !val || Number(val) === 0;
                                                    return (
                                                        <td key={s} className={`px-1 py-1 text-center border font-semibold whitespace-nowrap ${isEmpty ? 'border-white bg-[#e2e8f0]' : 'border-slate-200 bg-white'}`}>
                                                            {isEmpty ? null : val}
                                                        </td>
                                                    );
                                                })}
                                                <td className="border-b border-slate-100 px-4 py-2.5 text-slate-600 max-w-xs truncate" title={row.note || ""}>
                                                    {row.note || "-"}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={handleCloseSnackbar} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
                <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} variant="filled" sx={{ width: '100%' }}>{snackbar.message}</Alert>
            </Snackbar>
        </div>
    );
}
