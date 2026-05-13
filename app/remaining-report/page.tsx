"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { sizes, sizeToCol } from "@/lib/size";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import { Snackbar, Alert } from "@mui/material";
import { ChevronDown, Search } from "lucide-react";
import { FaFilePdf } from "react-icons/fa6";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type RemainingRow = {
    ry_number: string;
    article?: string | null;
    model_name?: string | null;
    product?: string | null;
    delivery_round?: string | null;
    total_order_qty?: number | null;
    [key: string]: any;
    exports: any[];
    remaining: {
        ry_number: string;
        total_quantity: number;
        accumulated_total: number;
        remaining_quantity: number;
        [key: string]: any;
    };
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
            const res = await axios.get(`/api/remaining-stock?client=${encodeURIComponent(clientName)}&detailed=true`);
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



    const exportPdf = async () => {
        if (filteredRows.length === 0) return;
        
        try {
            const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
            
            // --- 1. Load Font ---
            try {
                const fontUrl = "https://unpkg.com/roboto-font@0.1.0/fonts/Roboto/roboto-regular-webfont.ttf";
                const res = await fetch(fontUrl);
                if (res.ok) {
                    const blob = await res.blob();
                    const base64Font = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
                        reader.onerror = reject;
                        reader.readAsDataURL(blob);
                    });
                    doc.addFileToVFS('Roboto-Regular.ttf', base64Font as string);
                    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
                    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'bold');
                    doc.setFont('Roboto');
                }
            } catch(e) { console.warn("Font error", e); }

            const pageWidth = doc.internal.pageSize.getWidth();
            let currentY = 40;

            doc.setFont('Roboto', 'bold');
            doc.setFontSize(16);
            doc.text("BÁO CÁO CHI TIẾT HÀNG CÒN LẠI", 30, currentY);
            currentY += 20;
            
            doc.setFont('Roboto', 'normal');
            doc.setFontSize(10);
            doc.text(`KHÁCH HÀNG: ${(client || "Tất cả").toUpperCase()}`, 30, currentY);
            currentY += 30;

            // Determine active sizes (only those that have values in order rows)
            let activeSizes = sizes.filter(s => {
                return filteredRows.some(row => (parseFloat(String(row[sizeToCol(s)])) || 0) > 0);
            });
            if (activeSizes.length === 0 && sizes.length > 0) activeSizes = [sizes[0]];

            const head = [[
                "STT", "LỆNH (RY)", "ART", "PRODUCT", "MODEL NAME", "CRD", "ĐỢT", "TỔNG DH", "ĐÃ GIAO", "CÒN LẠI", ...activeSizes.map(String)
            ]];

            const body = filteredRows.map((row, i) => {
                const remaining = row.remaining || {};
                return [
                    i + 1,
                    row.ry_number || "",
                    row.article || "-",
                    row.product || "-",
                    row.model_name || "-",
                    row.CRD || "-",
                    row.delivery_round || "-",
                    row.total_order_qty || 0,
                    remaining.accumulated_total || 0,
                    remaining.remaining_quantity || 0,
                    ...activeSizes.map(s => {
                        const val = row[sizeToCol(s)];
                        return (val && val !== 0 && val !== "0") ? val : "-";
                    })
                ];
            });

            autoTable(doc, {
                startY: currentY,
                head: head,
                body: body,
                theme: 'grid',
                tableWidth: 'wrap', // Fit content
                styles: { font: 'Roboto', fontSize: activeSizes.length > 15 ? 6 : 7.5, cellPadding: 2, valign: 'middle', halign: 'center' },
                headStyles: { fillColor: [241, 245, 249], textColor: [0, 0, 0], fontStyle: 'bold' },
                margin: { left: 30, right: 30 },
            });

            doc.save(`Remaining_Report_${(client || "All").replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (error: any) {
            console.error("PDF Export error:", error);
            alert("Lỗi xuất PDF: " + error.message);
        }
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
                        value={(orderRy || null) as any}
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

                    <button
                        onClick={exportPdf}
                        className="flex items-center justify-center text-rose-600 hover:text-rose-700 transition-all shrink-0 ml-1 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Xuất PDF"
                        disabled={!client || rows.length === 0}
                    >
                        <FaFilePdf size={28} className="cursor-pointer" />
                    </button>

                </div>

                <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto rounded-xl border border-slate-200 touch-pan-x overscroll-x-contain report-scrollbar">
                    <table className="border-collapse text-sm w-max table-fixed">
                        <thead className="sticky top-0 z-40 bg-slate-100 text-slate-600">
                            <tr className="border-b border-slate-200">
                                <th className="sticky left-0 z-50 bg-slate-100 px-3 py-3 text-center font-bold text-slate-800 border-r border-slate-200" style={{ width: "48px", minWidth: "48px" }}>STT</th>
                                <th className="sticky z-50 bg-slate-100 px-3 py-3 text-center font-bold text-slate-800 whitespace-nowrap border-r border-slate-200 shadow-[inset_-1px_0_0_0_#e2e8f0]" style={{ left: "48px" }}>LỆNH (RY)</th>
                                <th className="bg-slate-100 px-4 py-3 text-center font-bold text-slate-800 whitespace-nowrap border-r border-slate-100">ARTICLE</th>
                                <th className="bg-slate-100 px-4 py-3 text-center font-bold text-slate-800 whitespace-nowrap border-r border-slate-100">ĐỢT HÀNG</th>
                                <th className="bg-slate-100 px-4 py-3 text-center font-bold text-slate-800 whitespace-nowrap border-r border-slate-100">PRODUCT</th>
                                <th className="bg-slate-100 px-4 py-3 text-center font-bold text-slate-800 whitespace-nowrap border-r border-slate-100">MODEL NAME</th>
                                <th className="bg-slate-100 px-4 py-3 text-center font-bold text-slate-800 whitespace-nowrap border-r border-slate-100">CRD</th>
                                <th className="bg-slate-200 px-4 py-3 text-center font-bold text-blue-800 whitespace-nowrap border-r border-slate-100">SỐ LƯỢNG DH</th>
                                <th className="bg-slate-200 px-4 py-3 text-center font-bold text-purple-800 whitespace-nowrap border-r border-slate-100">SL ĐÃ GIAO</th>
                                <th className="bg-slate-200 px-4 py-3 text-center font-bold text-rose-800 whitespace-nowrap border-r border-slate-100">SL CHƯA GIAO</th>
                                <th className="bg-slate-100 px-4 py-3 text-center font-bold text-slate-800 whitespace-nowrap border-r border-slate-100">NGÀY GIAO</th>
                                {sizes.map((s) => (
                                    <th key={s} className="bg-slate-100 px-1 py-3 text-center font-bold text-slate-800 w-12 border border-white">{s}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRows.map((row, orderIdx) => {
                                const exports = row.exports || [];
                                const remaining = row.remaining;

                                // Generate a unique light color for each group using HSL
                                const hue = (orderIdx * 137.5) % 360; // Golden angle for even distribution
                                const currentBg = `hsl(${hue}, 80%, 97%)`;
                                const hoverBg = `hsl(${hue}, 80%, 94%)`;

                                return (
                                    <React.Fragment key={row.ry_number}>
                                        {/* Row Đơn Hàng (Order Row) */}
                                        <tr className="hover:opacity-95 transition-opacity border-b border-slate-200/60" style={{ backgroundColor: currentBg }}>
                                            <td className="sticky left-0 z-20 px-3 py-2 text-center font-bold shadow-[inset_-1px_0_0_0_#cbd5e1]" style={{ width: "48px", minWidth: "48px", backgroundColor: currentBg }}>{orderIdx + 1}</td>
                                            <td className="sticky z-20 px-3 py-2 text-center font-bold text-emerald-800 whitespace-nowrap shadow-[inset_-1px_0_0_0_#cbd5e1]" style={{ left: "48px", backgroundColor: currentBg }}>{row.ry_number}</td>
                                            <td className="px-4 py-2 text-center font-bold text-blue-800 whitespace-nowrap border-r border-slate-200/60">{row.article || "-"}</td>
                                            <td className="px-4 py-2 text-center font-medium whitespace-nowrap border-r border-slate-200/60">{row.delivery_round || "-"}</td>
                                            <td className="px-4 py-2 text-center font-medium whitespace-nowrap border-r border-slate-200/60">{row.product || "-"}</td>
                                            <td className="px-4 py-2 text-center font-medium whitespace-nowrap border-r border-slate-200/60">{row.model_name || "-"}</td>
                                            <td className="px-4 py-2 text-center font-bold text-blue-600 whitespace-nowrap border-r border-slate-200/60">{row.CRD || "-"}</td>
                                            <td className="px-4 py-2 text-center font-bold text-blue-800 whitespace-nowrap border-r border-slate-200/60 bg-blue-100/10">{row.total_order_qty || 0}</td>
                                            <td className="px-4 py-2 text-center font-bold text-purple-800 whitespace-nowrap border-r border-slate-200/60 bg-purple-100/10">{remaining.accumulated_total || 0}</td>
                                            <td className={`px-4 py-2 text-center font-bold whitespace-nowrap border-r border-slate-200/60 ${remaining.remaining_quantity === 0 ? "text-emerald-700" : "text-rose-700"}`}>{remaining.remaining_quantity || 0}</td>
                                            <td className="px-4 py-2 text-center font-bold text-slate-800 whitespace-nowrap border-r border-slate-200/60 bg-black/5 italic">ĐƠN HÀNG</td>
                                            {sizes.map((s) => {
                                                const col = sizeToCol(s);
                                                const val = row[col];
                                                const hasVal = val !== null && val !== undefined && Number(val) !== 0;
                                                return (
                                                    <td key={s} className={`px-1 py-1 text-center font-bold border border-slate-200/50 ${hasVal ? "bg-white text-blue-700" : "bg-[#f8fafc] text-transparent select-none"}`}>
                                                        {hasVal ? val : ""}
                                                    </td>
                                                );
                                            })}
                                        </tr>

                                        {/* Rows Ngày Giao (Export Rows) */}
                                        {exports.map((exp: any, expIdx: number) => (
                                            <tr key={exp.id} className="hover:opacity-95 transition-opacity border-b border-slate-100/60 italic" style={{ backgroundColor: currentBg }}>
                                                <td className="sticky left-0 z-20 shadow-[inset_-1px_0_0_0_#cbd5e1]" style={{ width: "48px", minWidth: "48px", backgroundColor: currentBg }}></td>
                                                <td className="sticky z-20 shadow-[inset_-1px_0_0_0_#cbd5e1]" style={{ left: "48px", backgroundColor: currentBg }}></td>
                                                <td className="border-r border-slate-200/60"></td>
                                                <td className="border-r border-slate-200/60"></td>
                                                <td className="border-r border-slate-200/60"></td>
                                                <td className="border-r border-slate-200/60"></td>
                                                <td className="border-r border-slate-200/60"></td>
                                                <td className="border-r border-slate-200/60"></td>
                                                <td className="border-r border-slate-200/60"></td>
                                                <td className="border-r border-slate-200/60"></td>
                                                <td className="px-4 py-1 text-center text-slate-600 font-medium border-r border-slate-200/60 bg-white/20">{exp.export_date}</td>
                                                {sizes.map((s) => {
                                                    const col = sizeToCol(s);
                                                    const val = exp[col];
                                                    const hasVal = val !== null && val !== undefined && Number(val) !== 0;
                                                    return (
                                                        <td key={s} className={`px-1 py-1 text-center font-medium border border-slate-200/50 ${hasVal ? "bg-white text-slate-700" : "bg-[#f8fafc] text-transparent select-none"}`}>
                                                            {hasVal ? val : ""}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}

                                        {/* Row Còn Lại (Summary Row) */}
                                        <tr className="font-bold border-b border-slate-300/60" style={{ backgroundColor: currentBg }}>
                                            <td className="sticky left-0 z-20 shadow-[inset_-1px_0_0_0_#cbd5e1]" style={{ width: "48px", minWidth: "48px", backgroundColor: currentBg }}></td>
                                            <td className="sticky z-20 shadow-[inset_-1px_0_0_0_#cbd5e1]" style={{ left: "48px", backgroundColor: currentBg }}></td>
                                            <td className="border-r border-slate-200/60"></td>
                                            <td className="border-r border-slate-200/60"></td>
                                            <td className="border-r border-slate-200/60"></td>
                                            <td className="border-r border-slate-200/60"></td>
                                            <td className="border-r border-slate-200/60"></td>
                                            <td className="border-r border-slate-200/60"></td>
                                            <td className="border-r border-slate-200/60"></td>
                                            <td className="border-r border-slate-200/60"></td>
                                            <td className="px-4 py-2 text-center text-rose-700 border-r border-slate-200/60 bg-rose-500/10">CÒN LẠI</td>
                                            {sizes.map((s) => {
                                                const col = sizeToCol(s);
                                                const originalVal = row[col];
                                                const remainingVal = remaining[col];
                                                const hasOriginal = originalVal !== null && originalVal !== undefined && Number(originalVal) !== 0;

                                                if (!hasOriginal) {
                                                    return <td key={s} className="px-1 py-1 bg-[#f8fafc] border border-slate-200/50"></td>;
                                                }

                                                const isZero = Number(remainingVal) <= 0;
                                                return (
                                                    <td key={s} className={`px-1 py-1 text-center font-bold border border-slate-200/50 ${isZero ? "bg-emerald-500/10 text-emerald-600" : "bg-white text-rose-600"}`}>
                                                        {isZero ? "OK" : remainingVal}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                        <tfoot className="sticky bottom-0 z-40 bg-yellow-400 font-bold text-slate-900 shadow-[0_-2px_4px_rgba(0,0,0,0.1)]">
                            <tr>
                                <td colSpan={2} className="sticky left-0 z-50 bg-yellow-400 px-3 py-3 text-center border-r border-yellow-500 shadow-[inset_-1px_0_0_0_#eab308]" style={{ width: "100px", minWidth: "100px" }}>TỔNG</td>
                                <td className="px-4 py-3 text-center border-r border-yellow-500"></td>
                                <td className="px-4 py-3 text-center border-r border-yellow-500"></td>
                                <td className="px-4 py-3 text-center border-r border-yellow-500"></td>
                                <td className="px-4 py-3 text-center border-r border-yellow-500"></td>
                                <td className="px-4 py-3 text-center border-r border-yellow-500"></td>
                                <td className="px-4 py-3 text-center border-r border-yellow-500 bg-yellow-500/30">
                                    {filteredRows.reduce((sum, r) => sum + (Number(r.total_order_qty) || 0), 0).toLocaleString()}
                                </td>
                                <td className="px-4 py-3 text-center border-r border-yellow-500 bg-yellow-500/30">
                                    {filteredRows.reduce((sum, r) => sum + (Number(r.remaining?.accumulated_total) || 0), 0).toLocaleString()}
                                </td>
                                <td className="px-4 py-3 text-center border-r border-yellow-500 bg-yellow-500/30">
                                    {filteredRows.reduce((sum, r) => sum + (Number(r.remaining?.remaining_quantity) || 0), 0).toLocaleString()}
                                </td>
                                <td className="px-4 py-3 text-center border-r border-yellow-500 bg-yellow-500/10 italic">TOTAL</td>
                                {sizes.map((s) => (
                                    <td key={s} className="px-1 py-3 text-center border border-yellow-500"></td>
                                ))}
                            </tr>
                        </tfoot>
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
