"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { sizes, sizeToCol } from "@/lib/size";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import { Snackbar, Alert } from "@mui/material";
import { ChevronDown, Printer, FileSpreadsheet, Search } from "lucide-react";

type RemainingRow = {
    id: string | number;
    ry_number: string;
    article?: string | null;
    model_name?: string | null;
    product?: string | null;
    delivery_round?: string | null;
    total_quantity?: number | null;
    accumulated_total?: number | null;
    remaining_quantity?: number | null;
    [key: string]: string | number | null | undefined;
};

const autocompletePopupIcon = <ChevronDown size={16} />;

export default function RemainingReportPage() {
    const [client, setClient] = useState<string | undefined>("");
    const [clients, setClients] = useState<string[]>([]);
    const [orderRy, setOrderRy] = useState("");
    const [orders, setOrders] = useState<RemainingRow[]>([]);
    const [rows, setRows] = useState<RemainingRow[]>([]);
    const [mounted, setMounted] = useState(false);

    const [snackbar, setSnackbar] = useState<{
        open: boolean;
        message: string;
        severity: "success" | "error" | "info" | "warning";
    }>({
        open: false,
        message: "",
        severity: "success",
    });

    useEffect(() => {
        setMounted(true);
        const loadInitialData = async () => {
            try {
                const res = await axios.get("/api/orders/clients");
                const list = Array.isArray(res.data)
                    ? (res.data as Array<{ client?: string }>)
                        .map((item) => item.client)
                        .filter((v): v is string => Boolean(v))
                    : [];
                setClients(list);
                if (list.length > 0) setClient(list[0]);
            } catch (err) {
                console.error("[API] Load clients error:", err);
            }
        };
        void loadInitialData();
    }, []);

    const fetchRows = useCallback(async (clientName: string) => {
        if (!clientName) {
            setRows([]);
            setOrders([]);
            return;
        }
        try {
            const res = await axios.get(`/api/remaining-stock?client=${encodeURIComponent(clientName)}`);
            const data = Array.isArray(res.data) ? (res.data as RemainingRow[]) : [];
            setRows(data);
            setOrders(data);
        } catch (err) {
            console.error("[API] Fetch remaining error:", err);
            setRows([]);
            setOrders([]);
        }
    }, []);

    useEffect(() => {
        if (mounted && client) {
            void fetchRows(client || "");
        }
    }, [client, mounted, fetchRows]);

    const filteredRows = useMemo(() => {
        if (!orderRy) return rows;
        return rows.filter((r) => r.ry_number === orderRy);
    }, [rows, orderRy]);

    const handleCloseSnackbar = (_?: React.SyntheticEvent | Event, reason?: string) => {
        if (reason === "clickaway") return;
        setSnackbar((prev) => ({ ...prev, open: false }));
    };

    const exportExcel = () => {
        const headers = ["STT", "ARTICLE", "ĐƠN HÀNG (RY)", "PRODUCT", "MODEL NAME", "ĐỢT", "TỔNG SL", "ĐÃ GIAO", "CÒN LẠI", ...sizes];
        const csvRows = filteredRows.map((row, idx) => {
            return [
                idx + 1,
                row.article || "-",
                row.ry_number,
                row.product || "-",
                row.model_name || "-",
                row.delivery_round || "-",
                row.total_quantity || 0,
                row.accumulated_total || 0,
                row.remaining_quantity || 0,
                ...sizes.map(s => row[sizeToCol(s)] ?? 0)
            ].join(",");
        });
        const csvContent = "\ufeff" + [headers.join(","), ...csvRows].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `remaining-report_${client}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (!mounted) return <div className="bg-slate-50 min-h-screen" />;

    return (
        <div className="mx-auto flex h-[calc(100dvh-80px)] min-h-[calc(100dvh-80px)] w-full flex-col gap-4 p-4 lg:p-6 overflow-hidden bg-slate-50 text-[13px]">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex-1 flex flex-col min-h-0">
                <div className="mb-4 shrink-0">
                    <h1 className="text-xl font-bold text-slate-950">Chi Tiết Hàng Còn Lại</h1>
                    <p className="text-sm text-slate-500">Xem số lượng còn lại theo khách hàng và mã đơn.</p>
                </div>

                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center shrink-0">
                    <Autocomplete
                        options={clients}
                        value={(client || null) as any}
                        disableClearable
                        popupIcon={autocompletePopupIcon}
                        forcePopupIcon={true}
                        onChange={(_, newValue) => {
                            if (newValue) {
                                setClient(newValue);
                                setOrderRy("");
                            }
                        }}
                        renderInput={(params) => (
                            <TextField {...params} placeholder="Tất cả khách hàng" variant="outlined" fullWidth
                                sx={{
                                    "& .MuiOutlinedInput-root": {
                                        height: "42px", borderRadius: "12px", backgroundColor: "white",
                                        "& fieldset": { borderColor: "#e2e8f0" },
                                        "&:hover fieldset": { borderColor: "#cbd5e1" },
                                        "&.Mui-focused fieldset": { borderColor: "#3b82f6", borderWidth: "1px" },
                                    },
                                    "& .MuiInputBase-input": { fontSize: "1rem", color: "#1e293b", fontWeight: "500" }
                                }}
                            />
                        )}
                        sx={{
                            width: "240px",
                            '& .MuiAutocomplete-endAdornment': { right: 8, top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: '4px', alignItems: 'center' },
                            '& .MuiAutocomplete-clearIndicator, & .MuiAutocomplete-popupIndicator': {
                                width: 28, height: 28, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9 !important', borderRadius: '999px',
                            },
                            '& .MuiAutocomplete-clearIndicator svg, & .MuiAutocomplete-popupIndicator svg': { width: 16, height: 16, color: '#374151' },
                        }}
                    />

                    <Autocomplete
                        options={Array.from(new Set(rows.map((o) => o.ry_number)))}
                        value={orderRy || null}
                        popupIcon={autocompletePopupIcon}
                        forcePopupIcon={true}
                        onChange={(_, newValue) => setOrderRy(newValue ?? "")}
                        renderInput={(params) => (
                            <TextField {...params} placeholder="Tìm mã đơn hàng..." variant="outlined" fullWidth
                                sx={{
                                    "& .MuiOutlinedInput-root": {
                                        height: "42px", borderRadius: "12px", backgroundColor: "white",
                                        "& fieldset": { borderColor: "#e2e8f0" },
                                        "&:hover fieldset": { borderColor: "#cbd5e1" },
                                        "&.Mui-focused fieldset": { borderColor: "#3b82f6", borderWidth: "1px" },
                                    },
                                    "& .MuiInputBase-input": { fontSize: "1rem", color: "#1e293b", fontWeight: "500" }
                                }}
                            />
                        )}
                        sx={{
                            width: "240px",
                            '& .MuiAutocomplete-endAdornment': { right: 8, top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: '4px', alignItems: 'center' },
                            '& .MuiAutocomplete-clearIndicator, & .MuiAutocomplete-popupIndicator': {
                                width: 28, height: 28, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9 !important', borderRadius: '999px',
                            },
                            '& .MuiAutocomplete-clearIndicator svg, & .MuiAutocomplete-popupIndicator svg': { width: 16, height: 16, color: '#374151' },
                        }}
                    />


                </div>

                <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto rounded-xl border border-slate-200 touch-pan-x overscroll-x-contain report-scrollbar">
                    <table className="border-collapse text-sm w-max min-w-full table-fixed">
                        <thead className="sticky top-0 z-40 bg-slate-100 text-slate-600">
                            <tr className="border-b border-slate-200">
                                <th className="sticky left-0 z-50 bg-slate-100 px-3 py-3 text-center font-bold text-slate-800 w-12 border-r border-slate-100 shadow-[inset_-1px_0_0_0_#f1f5f9]">STT</th>
                                <th className="sticky left-12 z-50 bg-slate-100 px-3 py-3 text-center font-bold text-slate-800 whitespace-nowrap border-r border-slate-100 shadow-[inset_-1px_0_0_0_#f1f5f9]">ĐƠN HÀNG (RY)</th>
                                <th className="bg-slate-100 px-4 py-3 text-center font-bold text-slate-800 whitespace-nowrap border-r border-slate-100">ARTICLE</th>
                                <th className="bg-slate-100 px-4 py-3 text-center font-bold text-slate-800 whitespace-nowrap border-r border-slate-100">MODEL NAME</th>
                                <th className="bg-slate-100 px-4 py-3 text-center font-bold text-slate-800 whitespace-nowrap border-r border-slate-100">PRODUCT</th>
                                <th className="bg-slate-200 px-4 py-3 text-center font-bold text-blue-800 whitespace-nowrap border-r border-slate-100">TỔNG SL</th>
                                <th className="bg-slate-200 px-4 py-3 text-center font-bold text-purple-800 whitespace-nowrap border-r border-slate-100">ĐÃ GIAO</th>
                                <th className="bg-slate-200 px-4 py-3 text-center font-bold text-slate-800 whitespace-nowrap border-r border-slate-100">CÒN LẠI</th>
                                <th className="bg-slate-100 px-4 py-3 text-center font-bold text-slate-800 whitespace-nowrap border-r border-slate-100">TRẠNG THÁI</th>
                                {sizes.map((s) => (
                                    <th key={s} className="bg-slate-100 px-1 py-3 text-center font-bold text-slate-800 w-12 border border-white">{s}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRows.map((row, idx) => {
                                const rowBg = idx % 2 === 0 ? "bg-white" : "bg-slate-50";
                                return (
                                    <tr key={idx} className={`${rowBg} hover:bg-blue-50/50 transition-colors border-b border-slate-100`}>
                                        <td className={`sticky left-0 z-20 ${rowBg} px-3 py-2 text-center font-bold border-r border-slate-100 shadow-[inset_-1px_0_0_0_#f1f5f9]`}>{idx + 1}</td>
                                        <td className={`sticky left-12 z-20 ${rowBg} px-3 py-2 text-center font-bold text-emerald-700 whitespace-nowrap border-r border-slate-100 shadow-[inset_-1px_0_0_0_#f1f5f9]`}>{row.ry_number}</td>
                                        <td className="px-4 py-2 text-center font-bold text-blue-700 whitespace-nowrap border-r border-slate-100">{row.article || "-"}</td>
                                        <td className="px-4 py-2 text-center font-medium whitespace-nowrap border-r border-slate-100">{row.model_name || "-"}</td>
                                        <td className="px-4 py-2 text-center font-medium whitespace-nowrap border-r border-slate-100">{row.product || "-"}</td>
                                        <td className="px-4 py-2 text-center font-bold text-blue-700 whitespace-nowrap border-r border-slate-100 bg-blue-50/20">{row.total_quantity || 0}</td>
                                        <td className="px-4 py-2 text-center font-bold text-purple-700 whitespace-nowrap border-r border-slate-100 bg-purple-50/20">{row.accumulated_total || 0}</td>
                                        <td className={`px-4 py-2 text-center font-bold whitespace-nowrap border-r border-slate-100 bg-slate-50 ${(row.remaining_quantity ?? 0) === 0 ? "text-emerald-600" : "text-rose-600"}`}>{row.remaining_quantity || 0}</td>
                                        <td className={`px-0 py-0 border-r border-slate-100 whitespace-nowrap text-center align-middle ${(row.remaining_quantity || 0) === 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-[#fee2e2] text-rose-600'}`}>
                                            <div className="w-full h-full min-h-9 flex items-center justify-center font-bold text-[11px]">
                                                {(row.remaining_quantity || 0) === 0 ? "OK" : "NOT OK"}
                                            </div>
                                        </td>
                                        {sizes.map((s) => {
                                            const col = sizeToCol(s);
                                            const originalVal = row[`o${col}`];
                                            const remainingVal = row[col];

                                            if (originalVal === null || originalVal === undefined || Number(originalVal) === 0) {
                                                return (
                                                    <td key={s} className="px-1 py-1 text-center font-bold border border-white bg-[#e2e8f0] text-transparent select-none">
                                                    </td>
                                                );
                                            }

                                            const isZero = Number(remainingVal) === 0;
                                            return (
                                                <td key={s} className={`px-1 py-1 text-center font-bold border border-slate-200 ${isZero ? "bg-emerald-50 text-emerald-600" : "bg-white text-rose-600"}`}>
                                                    {isZero ? "OK" : remainingVal}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={handleCloseSnackbar} anchorOrigin={{ vertical: "bottom", horizontal: "right" }}>
                <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} variant="filled" sx={{ width: "100%" }}>{snackbar.message}</Alert>
            </Snackbar>
            <style jsx global>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div>
    );
}
