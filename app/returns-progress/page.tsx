"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { entrySizes, sizeToCol } from "@/lib/size";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import { Snackbar, Alert } from "@mui/material";
import { ChevronDown } from "lucide-react";
import { FaFilePdf } from "react-icons/fa";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type RemainingReturnRow = {
    ry_number: string;
    client: string;
    shipping_round: number;
    article?: string;
    model_name?: string;
    product?: string;
    total_received: number;
    total_shipped: number;
    remaining_quantity: number;
    [key: string]: any;
};

const autocompletePopupIcon = <ChevronDown size={16} />;

export default function ReturnsRemainingReportPage() {
    const [client, setClient] = useState<string | undefined>("");
    const [clients, setClients] = useState<string[]>([]);
    const [orderRy, setOrderRy] = useState("");
    const [rows, setRows] = useState<RemainingReturnRow[]>([]);
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
        const loadClients = async () => {
            try {
                const res = await axios.get("/api/returns/clients");
                const list = Array.isArray(res.data) ? (res.data as string[]) : [];
                setClients(list);
                if (!client && list.length > 0) {
                    setClient(list[0]);
                }
            } catch (err) {
                console.error("[API] Load clients error:", err);
            }
        };
        void loadClients();
    }, []);

    const fetchRows = useCallback(async (clientName: string) => {
        if (!clientName) {
            setRows([]);
            return;
        }
        try {
            const res = await axios.get(`/api/returns/remaining?client=${encodeURIComponent(clientName)}`);
            const data = Array.isArray(res.data) ? (res.data as RemainingReturnRow[]) : [];
            setRows(data);
        } catch (err) {
            console.error("[API] Fetch remaining error:", err);
            setRows([]);
        }
    }, []);

    useEffect(() => {
        if (mounted && client) {
            void fetchRows(client || "");
        }
    }, [client, mounted, fetchRows]);

    const filteredRows = useMemo(() => {
        if (!orderRy) return rows;
        return rows.filter((r) => r.ry_number.toLowerCase().includes(orderRy.toLowerCase()));
    }, [rows, orderRy]);

    const exportPDF = () => {
        if (!client) return;
        const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
        
        doc.setFontSize(16);
        doc.text("BÁO CÁO TIẾN ĐỘ HÀNG TRẢ SỬA", doc.internal.pageSize.width / 2, 40, { align: 'center' });
        doc.setFontSize(12);
        doc.text(`Khách hàng: ${client}`, 40, 65);
        doc.text(`Ngày xuất: ${new Date().toLocaleDateString('vi-VN')}`, 40, 85);

        const tableHeaders = [
            "STT", "Đơn Hàng", "Lô Hàng", "Article", "Model Name", "CRD", "Product", 
            "SL Đã Nhận", "SL Đã Trả", "Còn Lại", ...entrySizes
        ];

        const tableRows = filteredRows.map((row, idx) => [
            idx + 1,
            row.ry_number,
            `Lô ${row.shipping_round}`,
            row.article || "-",
            row.model_name || "-",
            row.CRD || "-",
            row.product || "-",
            row.total_received,
            row.total_shipped,
            row.remaining_quantity === 0 ? "OK" : row.remaining_quantity,
            ...entrySizes.map(s => row[sizeToCol(s)] || 0)
        ]);

        autoTable(doc, {
            head: [tableHeaders],
            body: tableRows,
            startY: 100,
            styles: { fontSize: 8, font: 'helvetica' },
            headStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59] },
        });

        doc.save(`TienDo_TraSua_${client}_${new Date().getTime()}.pdf`);
    };

    const handleCloseSnackbar = (_?: React.SyntheticEvent | Event, reason?: string) => {
        if (reason === "clickaway") return;
        setSnackbar((prev) => ({ ...prev, open: false }));
    };

    if (!mounted) return <div className="bg-slate-50 min-h-screen" />;

    return (
        <div className="mx-auto flex h-[calc(100dvh-80px)] min-h-[calc(100dvh-80px)] w-full flex-col gap-4 p-4 lg:p-6 overflow-hidden bg-slate-50 text-[13px]">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex-1 flex flex-col min-h-0">
                <div className="mb-4 shrink-0">
                    <h1 className="text-xl font-bold text-slate-950 uppercase">Tiến Độ Trả Sửa</h1>
                    <p className="text-sm text-slate-500">Xem số lượng hàng trả sửa còn lại theo khách hàng và lô hàng.</p>
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
                            <TextField {...params} placeholder="Khách hàng" variant="outlined" fullWidth
                                sx={{
                                    "& .MuiOutlinedInput-root": {
                                        height: "42px", borderRadius: "12px", backgroundColor: "white",
                                        "& fieldset": { borderColor: "#e2e8f0" },
                                        "&.Mui-focused fieldset": { borderColor: "#000" },
                                    },
                                    "& .MuiInputBase-input": { fontSize: "1rem", color: "#1e293b", fontWeight: "500" }
                                }}
                            />
                        )}
                        sx={{ width: "240px" }}
                    />

                    <TextField
                        placeholder="Tìm mã đơn hàng..."
                        variant="outlined"
                        value={orderRy}
                        onChange={(e) => setOrderRy(e.target.value)}
                        sx={{
                            width: "240px",
                            "& .MuiOutlinedInput-root": {
                                height: "42px", borderRadius: "12px", backgroundColor: "white",
                                "& fieldset": { borderColor: "#e2e8f0" },
                                "&.Mui-focused fieldset": { borderColor: "#000" },
                            },
                            "& .MuiInputBase-input": { fontSize: "1rem", color: "#1e293b", fontWeight: "500" }
                        }}
                    />

                    <button
                        onClick={exportPDF}
                        disabled={!client || rows.length === 0}
                        className="flex items-center justify-center text-rose-600 hover:text-rose-700 transition-all shrink-0 ml-1"
                        title="Xuất PDF"
                    >
                        <FaFilePdf size={28} className="cursor-pointer" />
                    </button>
                </div>

                <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto rounded-xl border border-slate-200 report-scrollbar">
                    <table className="border-collapse text-sm w-max min-w-full table-fixed">
                        <thead className="sticky top-0 z-40 bg-slate-100 text-slate-600">
                            <tr className="border-b border-slate-200">
                                <th className="sticky left-0 z-50 bg-slate-100 px-3 py-3 text-center font-bold text-slate-800 border-r border-slate-200" style={{ width: "48px", minWidth: "48px" }}>STT</th>
                                <th className="sticky z-50 bg-slate-100 px-3 py-3 text-center font-bold text-slate-800 whitespace-nowrap border-r border-slate-200 shadow-[inset_-1px_0_0_0_#e2e8f0]" style={{ left: "48px", width: "120px" }}>ĐƠN HÀNG</th>
                                <th className="bg-slate-100 px-4 py-3 text-center font-bold text-slate-800 border-r border-slate-100 w-24">LÔ HÀNG</th>
                                <th className="bg-slate-100 px-4 py-3 text-center font-bold text-slate-800 border-r border-slate-100 w-32">ARTICLE</th>
                                <th className="bg-slate-100 px-4 py-3 text-center font-bold text-slate-800 border-r border-slate-100 w-32">MODEL NAME</th>
                                <th className="bg-slate-100 px-4 py-3 text-center font-bold text-slate-800 border-r border-slate-100 w-32">CRD</th>
                                <th className="bg-slate-100 px-4 py-3 text-center font-bold text-slate-800 border-r border-slate-100 w-32">PRODUCT</th>
                                <th className="bg-slate-200 px-4 py-3 text-center font-bold text-blue-800 border-r border-slate-100 w-32">SL ĐÃ NHẬN</th>
                                <th className="bg-slate-200 px-4 py-3 text-center font-bold text-purple-800 border-r border-slate-100 w-32">SL ĐÃ TRẢ</th>
                                <th className="bg-slate-200 px-4 py-3 text-center font-bold text-rose-800 border-r border-slate-100 w-32">CÒN LẠI</th>
                                {entrySizes.map((s) => (
                                    <th key={s} className="bg-slate-100 px-1 py-3 text-center font-bold text-slate-800 w-12 border border-white">{s}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRows.map((row, idx) => {
                                const isZero = row.remaining_quantity === 0;
                                return (
                                    <tr key={`${row.ry_number}_${row.shipping_round}`} className="hover:bg-slate-50 border-b border-slate-100">
                                        <td className="sticky left-0 z-20 px-3 py-2 text-center font-bold bg-white shadow-[inset_-1px_0_0_0_#e2e8f0]">{idx + 1}</td>
                                        <td className="sticky left-[48px] z-20 px-3 py-2 text-center font-bold text-blue-800 bg-white shadow-[inset_-1px_0_0_0_#e2e8f0]">{row.ry_number}</td>
                                        <td className="px-4 py-2 text-center font-bold text-orange-600 border-r border-slate-100">Lô {row.shipping_round}</td>
                                        <td className="px-4 py-2 text-center font-bold text-[#e59f67] border-r border-slate-100">{row.article || "-"}</td>
                                        <td className="px-4 py-2 text-center font-bold text-[#e59f67] border-r border-slate-100">{row.model_name || "-"}</td>
                                        <td className="px-4 py-2 text-center font-bold text-blue-600 border-r border-slate-100">{row.CRD || "-"}</td>
                                        <td className="px-4 py-2 text-center font-bold text-[#e59f67] border-r border-slate-100">{row.product || "-"}</td>
                                        <td className="px-4 py-2 text-center font-bold text-blue-800 bg-blue-50/30 border-r border-slate-100">{row.total_received}</td>
                                        <td className="px-4 py-2 text-center font-bold text-purple-800 bg-purple-50/30 border-r border-slate-100">{row.total_shipped}</td>
                                        <td className={`px-4 py-2 text-center font-bold border-r border-slate-100 ${isZero ? "text-emerald-600 bg-emerald-50/30" : "text-rose-600 bg-rose-50/30"}`}>
                                            {isZero ? "OK" : row.remaining_quantity}
                                        </td>
                                        {entrySizes.map((s) => {
                                            const col = sizeToCol(s);
                                            const val = row[col];
                                            const hasVal = val !== null && val !== undefined && val !== 0;
                                            return (
                                                <td key={s} className={`px-1 py-2 text-center font-medium border border-slate-100 ${hasVal ? "text-slate-900" : "text-transparent"}`}>
                                                    {hasVal ? val : "-"}
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
        </div>
    );
}
