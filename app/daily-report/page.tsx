"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import axios from "axios";
import { entrySizes, sizeToCol, sizes } from "@/lib/size";
import { groupByDate } from "@/lib/shared";
import { useSharedReportClient } from "@/lib/useSharedReportClient";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import { Snackbar, Alert } from "@mui/material";
import { ChevronDown, X as LucideX, Edit, Trash2 } from "lucide-react";
import { FaFilePdf } from "react-icons/fa6";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type HistoryDateOption = {
    export_date: string;
    formatted_date: string;
};

function formatUpdateDateTime(value?: string | null): { d: string; t: string } | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const d = date.toLocaleDateString("vi-VN", { day: '2-digit', month: '2-digit', year: 'numeric' });
    const t = date.toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    return { d, t };
}

type DailyReportRow = {
    id: string | number;
    ry_number: string;
    export_date: string;
    note?: string | null;
    delivery_round?: string | null;
    article?: string | null;
    model_name?: string | null;
    product?: string | null;
    total_quantity?: number | null;
    accumulated_total?: number | null;
    shipped_quantity?: number | null;
    remaining_quantity?: number | null;
    updated_at?: string | null;
    created_at?: string | null;
    [key: string]: string | number | null | undefined;
};

type EditFormState = {
    id: string | number | null;
    export_date: string;
    note: string;
    sizeValues: Record<string, string>;
};

type GroupedDailyReportRows = {
    date: string;
    rows: DailyReportRow[];
};

const DAILY_TABLE_COL_WIDTHS = [
    48,   // STT
    112,  // ARTICLE
    144,  // ĐƠN HÀNG
    128,  // PRODUCT
    128,  // MODEL
    80,   // ROUND
    96,   // SL ĐƠN HÀNG
    96,   // SL TÍCH LŨY
    102,  // SL NGÀY
    102,  // SL CÒN LẠI
    92,   // TRẠNG THÁI
    ...entrySizes.map(() => 48), // SIZES
    180,  // NOTE
    120,  // UPDATED
    88,   // ACTIONS
];

const blankEdit: EditFormState = {
    id: null,
    export_date: "",
    note: "",
    sizeValues: {},
};

const autocompletePopupIcon = <ChevronDown size={16} />;

export default function DailyReportPage() {
    const [sharedClient, setSharedClient] = useSharedReportClient();
    const [client, setClient] = useState<string | undefined>(sharedClient || "");
    const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined);
    const [availableDates, setAvailableDates] = useState<HistoryDateOption[]>([]);
    const [clients, setClients] = useState<string[]>([]);
    const [rows, setRows] = useState<DailyReportRow[]>([]);
    const [editRow, setEditRow] = useState<DailyReportRow | null>(null);
    const [editForm, setEditForm] = useState(blankEdit);
    const [snackbar, setSnackbar] = useState<{
        open: boolean;
        message: string;
        severity: "success" | "error" | "info" | "warning";
    }>({
        open: false,
        message: "",
        severity: "success",
    });
    const clientRef = useRef(client);

    const isMounted = useSyncExternalStore(
        () => () => { },
        () => true,
        () => false
    );

    useEffect(() => {
        clientRef.current = client;
    }, [client]);

    const handleCloseSnackbar = (_?: React.SyntheticEvent | Event, reason?: string) => {
        if (reason === "clickaway") return;
        setSnackbar(prev => ({ ...prev, open: false }));
    };

    useEffect(() => {
        const loadClients = async () => {
            try {
                const res = await axios.get("/api/orders/clients");
                const list = Array.isArray(res.data)
                    ? (res.data as Array<{ client?: string }>)
                        .map((item) => item.client)
                        .filter((value): value is string => Boolean(value))
                    : [];
                setClients(list);
                if (!clientRef.current && list.length > 0) {
                    setClient(list[0]);
                    setSharedClient(list[0]);
                }
            } catch (err) {
                console.error("[API] Load clients error:", err);
            }
        };
        void loadClients();
    }, [setSharedClient]);

    useEffect(() => {
        const loadDates = async () => {
            if (!client) {
                setAvailableDates([]);
                setSelectedDate(undefined);
                return;
            }
            try {
                const res = await axios.get(`/api/history-export/dates?client=${encodeURIComponent(client)}`);
                const dates = Array.isArray(res.data) ? (res.data as HistoryDateOption[]) : [];
                setAvailableDates(dates);
                if (dates.length > 0) {
                    setSelectedDate(dates[0].export_date);
                } else {
                    setSelectedDate(undefined);
                }
            } catch (err) {
                console.error("[API] Load dates error:", err);
                setAvailableDates([]);
                setSelectedDate(undefined);
            }
        };
        void loadDates();
    }, [client]);

    const fetchRows = useCallback(async () => {
        if (!client) {
            setRows([]);
            return;
        }

        try {
            const params: Record<string, string> = { client: client || "" };
            if (selectedDate) {
                params.date = new Date(selectedDate).toLocaleDateString("vi-VN");
            }

            const res = await axios.get("/api/history-export", { params });
            setRows(Array.isArray(res.data) ? (res.data as DailyReportRow[]) : []);
        } catch (err) {
            console.error("[API] Fetch history-export error:", err);
            setRows([]);
        }
    }, [client, selectedDate]);

    useEffect(() => {
        void fetchRows();
    }, [fetchRows]);

    const grouped = useMemo(
        () => groupByDate(rows) as GroupedDailyReportRows[],
        [rows]
    );

    const openEdit = (row: DailyReportRow) => {
        const next: EditFormState = {
            id: row.id,
            export_date: row.export_date?.split("/").reverse().join("-") || "",
            note: row.note || "",
            sizeValues: {},
        };
        entrySizes.forEach((size) => {
            next.sizeValues[String(size)] = String(row[sizeToCol(size)] ?? 0);
        });
        setEditRow(row);
        setEditForm(next);
    };

    const saveEdit = async () => {
        if (!editRow) return;
        const payload: Record<string, string | number | null> = {
            export_date: editForm.export_date || null,
            note: editForm.note.trim() || null,
        };
        entrySizes.forEach((size) => {
            payload[sizeToCol(size)] = Number(editForm.sizeValues[String(size)]) || 0;
        });

        try {
            await axios.patch(`/api/history-export/${editRow.id}`, payload);
            setSnackbar({
                open: true,
                message: "Cập nhật báo cáo thành công.",
                severity: "success",
            });
            setEditRow(null);
            await fetchRows();
        } catch (error: unknown) {
            console.error("[API] Update error:", error);
            const errorResponse = error as { response?: { data?: { error?: string } }; message?: string };
            const errMsg = errorResponse.response?.data?.error || errorResponse.message || "Cập nhật thất bại.";
            setSnackbar({
                open: true,
                message: errMsg,
                severity: "error",
            });
        }
    };

    const deleteRow = async (row: DailyReportRow) => {
        if (!window.confirm(`Xóa báo cáo của ${row.ry_number}?`)) return;
        try {
            await axios.delete(`/api/history-export/${row.id}`);
            setSnackbar({
                open: true,
                message: "Đã xóa báo cáo.",
                severity: "success",
            });
            await fetchRows();
        } catch (error: unknown) {
            console.error("[API] Delete error:", error);
            const errorResponse = error as { response?: { data?: { error?: string } }; message?: string };
            const errMsg = errorResponse.response?.data?.error || errorResponse.message || "Xóa thất bại.";
            setSnackbar({
                open: true,
                message: errMsg,
                severity: "error",
            });
        }
    };

    const exportPdf = async (date: string, clientName: string) => {
        const group = grouped.find(g => g.date === date);
        if (!group) return;
        
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

            // Xác định các cột size có dữ liệu - lọc bỏ hoàn toàn các cột không có data
            let activeSizes = entrySizes.filter(s => {
                return group.rows.some(row => {
                    const val = row[sizeToCol(s)];
                    const num = parseFloat(String(val)) || 0;
                    return num > 0;
                });
            });
            if (activeSizes.length === 0 && entrySizes.length > 0) activeSizes = [entrySizes[0]];

            // const firstRow = group.rows[0] || {};
            const totalExported = group.rows.reduce((sum, r) => sum + (Number(r.shipped_quantity) || 0), 0);

            const pageWidth = doc.internal.pageSize.getWidth();
            
            // Tính toán độ rộng cột linh hoạt
            const isDensityHigh = activeSizes.length > 15;
            const sizeColWidth = isDensityHigh ? 18 : 22;
            const modelNameWidth = isDensityHigh ? 55 : 70;
            const artWidth = isDensityHigh ? 40 : 50;

            const tableColumnWidths = [
                25, // STT
                70, // ĐƠN HÀNG
                modelNameWidth, 
                40, // SL GIAO
                35, // CÒN LẠI
                30, // ĐƠN VỊ
                artWidth, 
                ...activeSizes.map(() => sizeColWidth),
                45  // GHI CHÚ
            ];

            const baseDesiredWidth = tableColumnWidths.reduce((sum, width) => sum + width, 0);
            
            // Mở rộng bảng để chiếm ít nhất 92% trang nhằm tránh khoảng trắng 2 bên quá lớn
            const minTableWidth = pageWidth - 60; 
            const finalTableWidth = Math.max(baseDesiredWidth, Math.min(baseDesiredWidth * 1.5, minTableWidth));
            
            const tableMargin = (pageWidth - finalTableWidth) / 2;
            const tableLeft = tableMargin;
            const tableRight = tableLeft + finalTableWidth;
            const tableWidth = finalTableWidth;

            // --- 2. Header & Top Summary ---
            doc.setFont('Roboto', 'bold');
            doc.setFontSize(16);
            doc.text("BIỂU GIAO THÀNH PHẨM", tableLeft, 40);
            
            doc.setFont('Roboto', 'normal');
            doc.setFontSize(10);
            doc.text("ĐƠN VỊ CHUYỂN: DD (Long An)", tableLeft, 60);
            doc.text(`ĐƠN VỊ LÃNH: ${clientName.toUpperCase()}`, tableRight, 60, { align: "right" });
            const summaryY = 85;
            doc.text(`Ngày: ${group.date}`, tableLeft, summaryY);
            doc.text("Kỳ: T1", tableLeft + (tableWidth / 2), summaryY, { align: "center" });

            // Nổi bật Tổng giao phía trên
            const totalLabel = `Tổng giao: ${totalExported}`;
            const labelWidth = doc.getTextWidth(totalLabel);
            const rectWidth = labelWidth + 15; 
            doc.setFillColor(255, 255, 0); 
            doc.rect(tableLeft, 93, rectWidth, 18, 'F'); 

            doc.setFont('Roboto', 'bold');
            doc.setTextColor(0, 0, 0); 
            doc.text(totalLabel, tableLeft + 7, 105);
            doc.setTextColor(0, 0, 0);

            // --- 3. Cấu trúc Table Data ---
            const head = [[
                "STT", "ĐƠN HÀNG", "MODEL NAME", "SL GIAO", 
                "CÒN LẠI", "ĐƠN VỊ", "ART", ...activeSizes.map(String), "GHI CHÚ"
            ]];

            const body = group.rows.map((row, i) => {
                const isOk = (Number(row.remaining_quantity) || 0) <= 0;
                return [
                    i + 1,
                    row.ry_number || "",
                    row.model_name || "",
                    row.shipped_quantity || 0,
                    isOk ? "OK" : row.remaining_quantity,
                    "ĐÔI",
                    row.article || "",
                    ...activeSizes.map(s => {
                        const val = row[sizeToCol(s as string|number)];
                        return (val && val !== 0 && val !== "0") ? val : "-";
                    }),
                    row.note || ""
                ] as (string | number)[];
            });

            const footerTotals = [
                "",             
                "",             
                "Tổng",         
                totalExported,  
                "",             
                "",             
                "",             
                ...activeSizes.map(() => ""),
                ""              
            ];

            const sizeColumnCount = activeSizes.length;
            const sizeStyles: any = {};
            activeSizes.forEach((_, index) => {
                sizeStyles[7 + index] = { cellWidth: 22 };
            });

            // --- 4. Render Table ---
            autoTable(doc, {
                startY: 125,
                head: head,
                body: body,
                foot: [footerTotals], 
                theme: 'grid',
                styles: {
                    font: 'Roboto',
                    fontSize: isDensityHigh ? 6 : 7.5,
                    cellPadding: isDensityHigh ? 1.5 : 3,
                    valign: 'middle',
                    halign: 'center',
                    lineColor: [80, 80, 80]
                },
                headStyles: {
                    fillColor: [240, 240, 240],
                    textColor: [0, 0, 0],
                    fontStyle: 'bold',
                    lineWidth: 0.5
                },
                footStyles: {
                    fillColor: [255, 255, 255],
                    textColor: [0, 0, 0],
                    fontStyle: 'bold',
                    fontSize: 8,
                    lineWidth: { top: 0.5, bottom: 0, left: 0, right: 0 }     
                },
                columnStyles: {
                    0: { cellWidth: 25 }, 
                    1: { cellWidth: 70, fontStyle: 'bold' }, 
                    2: { cellWidth: modelNameWidth, fontStyle: 'normal' }, 
                    3: { cellWidth: 40, fontStyle: 'bold' }, 
                    4: { cellWidth: 35 }, 
                    5: { cellWidth: 30 }, 
                    6: { cellWidth: artWidth }, 
                    ...sizeStyles,
                    [7 + sizeColumnCount]: { cellWidth: 45, halign: 'center' } 
                },
                didParseCell: function (data: any) {
                    if (data.column.index === 4 && data.cell.text[0] === 'OK') {
                        data.cell.styles.textColor = [0, 128, 0];
                        data.cell.styles.fontStyle = 'bold';
                    }
                },
                margin: { left: tableMargin, right: tableMargin },
                tableWidth
            });

            doc.save(`Bieu_Giao_${clientName.replace(/\s+/g, '_')}_${group.date.replace(/\//g, '-')}.pdf`);
        } catch (error: any) {
            console.error("PDF Export error:", error);
            alert("Lỗi xuất PDF: " + error.message);
        }
    };



    if (!isMounted) return null;

    return (
        <div className="mx-auto flex h-[calc(100dvh-80px)] min-h-[calc(100dvh-80px)] w-full flex-col gap-4 p-4 lg:p-6 overflow-hidden bg-slate-50 text-[13px]">
            <style jsx global>{`
                input[type='number']::-webkit-inner-spin-button,
                input[type='number']::-webkit-outer-spin-button {
                    -webkit-appearance: none;
                    margin: 0;
                }
                input[type='number'] {
                    -moz-appearance: textfield;
                }
            `}</style>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex-1 flex flex-col min-h-0">
                <div className="flex justify-between items-start mb-6 shrink-0">
                    <div>
                        <h1 className="text-lg font-bold uppercase text-slate-800 tracking-wide">
                            Phiếu Xuất Kho
                        </h1>
                        <p className="text-sm text-slate-400 mt-1">
                            Báo cáo chi tiết xuất kho hàng ngày
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
                        noOptionsText="Không có kết quả"
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                placeholder="Tất cả khách hàng"
                                variant="outlined"
                                sx={{
                                    "& .MuiOutlinedInput-root": {
                                        height: "42px",
                                        borderRadius: "12px",
                                        backgroundColor: "white",
                                        fontFamily: "inherit",
                                        "& fieldset": { borderColor: "#e2e8f0" },
                                        "&:hover fieldset": { borderColor: "#cbd5e1" },
                                        "&.Mui-focused fieldset": {
                                            borderColor: "#3b82f6",
                                            borderWidth: "1px",
                                        },
                                    },
                                    "& .MuiInputBase-input": {
                                        fontSize: "1rem",
                                        color: "#1e293b",
                                        fontWeight: "500",
                                    }
                                }}
                            />
                        )}
                        sx={{
                            width: "240px",
                            '& .MuiAutocomplete-endAdornment': { right: 8, top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: '4px', alignItems: 'center' },
                            '& .MuiAutocomplete-clearIndicator, & .MuiAutocomplete-popupIndicator': {
                                width: 28, height: 28, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9 !important', borderRadius: '999px',
                            },
                        }}
                    />

                    <Autocomplete
                        options={availableDates}
                        getOptionLabel={(option) => {
                            if (typeof option === 'string') return option;
                            return option.formatted_date || "";
                        }}
                        value={(availableDates.find(d => d.export_date === selectedDate) || null) as any}
                        disableClearable
                        popupIcon={autocompletePopupIcon}
                        forcePopupIcon={true}
                        onChange={(_, newValue) => {
                            if (newValue) {
                                setSelectedDate(newValue.export_date);
                            } else {
                                setSelectedDate(undefined);
                            }
                        }}
                        noOptionsText="Không có kết quả"
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                placeholder="Chọn ngày..."
                                variant="outlined"
                                sx={{
                                    "& .MuiOutlinedInput-root": {
                                        height: "42px",
                                        borderRadius: "12px",
                                        backgroundColor: "white",
                                        fontFamily: "inherit",
                                        "& fieldset": { borderColor: "#e2e8f0" },
                                        "&:hover fieldset": { borderColor: "#cbd5e1" },
                                        "&.Mui-focused fieldset": {
                                            borderColor: "#3b82f6",
                                            borderWidth: "1px",
                                        },
                                    },
                                    "& .MuiInputBase-input": {
                                        fontSize: "1rem",
                                        color: "#1e293b",
                                        fontWeight: "500",
                                    }
                                }}
                            />
                        )}
                        sx={{
                            width: "240px",
                            '& .MuiAutocomplete-endAdornment': { right: 8, top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: '4px', alignItems: 'center' },
                            '& .MuiAutocomplete-clearIndicator, & .MuiAutocomplete-popupIndicator': {
                                width: 28, height: 28, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9 !important', borderRadius: '999px',
                            },
                        }}
                    />

                    <button
                        onClick={() => {
                            const opt = availableDates.find(d => d.export_date === selectedDate);
                            const dateToPrint = opt?.formatted_date || (grouped[0]?.date);
                            if (dateToPrint) exportPdf(dateToPrint, client || "");
                        }}
                        className="flex items-center justify-center text-rose-600 hover:text-rose-700 transition-all shrink-0 ml-1"
                        title="Xuất PDF"
                        disabled={!client || rows.length === 0}
                    >
                        <FaFilePdf size={28} className="cursor-pointer" />
                    </button>
                </div>

                <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto rounded-xl border border-slate-200 touch-pan-x overscroll-x-contain report-scrollbar print:border-0 print:overflow-visible">
                    <table className="border-collapse text-sm w-max min-w-full table-fixed">
                        <thead className="sticky top-0 z-40 bg-slate-100">
                            <tr className="border-b border-slate-200">
                                <th className="md:sticky md:left-0 top-0 z-50 bg-slate-100 shadow-[inset_-1px_0_0_0_#f1f5f9] px-2 py-3 text-center font-bold text-slate-700 w-12 border-r border-slate-100">STT</th>
                                <th className="md:sticky md:left-12 top-0 z-50 bg-slate-100 shadow-[inset_-1px_0_0_0_#f1f5f9] px-3 py-3 text-center font-bold text-slate-700 w-40 border-r border-slate-100">Đơn Hàng</th>
                                <th className="top-0 border-r border-slate-100 bg-slate-100 px-4 py-3 text-center font-bold text-slate-700 whitespace-nowrap">Article</th>
                                <th className="top-0 border-r border-slate-100 bg-slate-100 px-4 py-3 text-center font-bold text-slate-700 whitespace-nowrap">Model Name</th>
                                <th className="top-0 border-r border-slate-100 bg-slate-100 px-4 py-3 text-center font-bold text-slate-700 whitespace-nowrap">Product</th>
                                <th className="top-0 border-r border-slate-100 bg-slate-50 px-4 py-3 text-center font-bold text-slate-700 whitespace-nowrap">SL Đơn Hàng</th>
                                <th className="top-0 border-r border-slate-100 bg-slate-50 px-4 py-3 text-center font-bold text-slate-700 whitespace-nowrap">SL Tích Lũy</th>
                                <th className="top-0 border-r border-slate-100 bg-slate-50 px-4 py-3 text-center font-bold text-slate-700 whitespace-nowrap">SL Ngày</th>
                                <th className="top-0 border-r border-slate-100 bg-slate-50 px-4 py-3 text-center font-bold text-slate-700 whitespace-nowrap">SL Còn Lại</th>
                                <th className="top-0 border-r border-slate-100 bg-slate-100 px-4 py-3 text-center font-bold text-slate-700 whitespace-nowrap">Trạng Thái</th>
                                {entrySizes.map((s) => (
                                    <th key={s} className="top-0 bg-slate-100 border-r px-1 py-3 text-center font-bold text-slate-800 w-11 border border-white">{s}</th>
                                ))}
                                <th className="md:sticky md:right-0 top-0 z-40 bg-slate-100 border-l border-slate-100 px-3 py-3 text-center font-bold text-slate-700 w-24 print:hidden">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {grouped.map((group) => (
                                <React.Fragment key={group.date}>
                                    {group.rows.map((row, index) => {
                                        const status = (row.remaining_quantity ?? 0) === 0 ? "Ok" : "Not Ok";
                                        const rowBg = index % 2 === 0 ? "bg-white" : "bg-slate-50";
                                        return (
                                            <tr key={row.id} className={`${rowBg} hover:bg-blue-50/20 transition-colors group border-b border-slate-100 last:border-0`}>
                                                <td className={`md:sticky md:left-0 z-20 shadow-[inset_-1px_0_0_0_#f1f5f9] px-3 py-2.5 font-bold text-slate-800 text-center whitespace-nowrap ${rowBg} group-hover:bg-blue-50 border-r border-slate-100`}>
                                                    {index + 1}
                                                </td>
                                                <td className={`md:sticky md:left-12 z-20 shadow-[inset_-1px_0_0_0_#f1f5f9] px-3 py-2.5 font-bold text-slate-900 text-center whitespace-nowrap ${rowBg} group-hover:bg-blue-50 border-r border-slate-100`}>
                                                    {row.ry_number}
                                                </td>
                                                <td className="border-r border-slate-100 px-3 py-2.5 font-bold text-[#e59f67] text-center whitespace-nowrap">{row.article || "-"}</td>
                                                <td className="border-r border-slate-100 px-3 py-2.5 font-bold text-[#e59f67] text-center whitespace-nowrap">{row.model_name || "-"}</td>
                                                <td className="border-r border-slate-100 px-3 py-2.5 font-bold text-[#e59f67] text-center whitespace-nowrap">{row.product || "-"}</td>
                                                <td className="border-r border-slate-100 px-3 py-2.5 font-bold text-[#3b82f6] text-center whitespace-nowrap">{row.total_quantity || 0}</td>
                                                <td className="border-r border-slate-100 px-3 py-2.5 font-bold text-[#a855f7] text-center whitespace-nowrap">{row.accumulated_total || 0}</td>
                                                <td className="border-r border-slate-100 px-3 py-2.5 font-bold text-[#0284c7] text-center whitespace-nowrap">{row.shipped_quantity || 0}</td>
                                                <td className={`border-r border-slate-100 px-3 py-2.5 font-bold text-center whitespace-nowrap ${row.remaining_quantity === 0 ? "text-[#16a34a]" : "text-[#ef4444]"}`}>
                                                    {row.remaining_quantity || 0}
                                                </td>
                                                <td className={`px-0 py-0 border-r border-slate-100 whitespace-nowrap text-center`}>
                                                    <div className={`w-full h-full min-h-[44px] flex items-center justify-center font-bold text-center text-[12px] whitespace-nowrap ${status === 'Ok' ? 'bg-emerald-50 text-emerald-600' : 'bg-[#fee2e2] text-rose-600'}`}>
                                                        {status}
                                                    </div>
                                                </td>
                                                {entrySizes.map((s) => {
                                                    const val = row[sizeToCol(s)];
                                                    const isEmpty = !val || Number(val) === 0;
                                                    return (
                                                        <td key={s} className={`px-1 py-1 text-center border font-semibold text-[13px] whitespace-nowrap ${isEmpty ? 'border-white bg-[#e2e8f0]' : 'border-slate-200 bg-white'}`}>
                                                            {isEmpty ? null : val}
                                                        </td>
                                                    );
                                                })}
                                                <td className={`md:sticky md:right-0 z-20 ${rowBg} border-l border-slate-200 px-2 py-2 group-hover:bg-blue-50 print:hidden whitespace-nowrap`}>
                                                    <div className="flex justify-center gap-2">
                                                        <button onClick={() => openEdit(row)} className="p-1 text-[#3b82f6] hover:bg-blue-100 rounded-md transition-colors" title="Chỉnh sửa">
                                                            <Edit size={16} />
                                                        </button>
                                                        <button onClick={() => deleteRow(row)} className="p-1 text-[#ef4444] hover:bg-red-50 rounded-md transition-colors" title="Xóa">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
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

            {editRow && (
                <div className="fixed inset-0 z-999 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setEditRow(null)}>
                    <div className="max-h-[90vh] w-full max-w-5xl overflow-auto rounded-2xl bg-white p-6 shadow-2xl border border-slate-200" onClick={e => e.stopPropagation()}>
                        <div className="mb-6 flex items-center justify-between border-b pb-4">
                            <div>
                                <h2 className="text-xl font-bold text-slate-900">Chỉnh sửa {editRow.ry_number}</h2>
                                <p className="text-sm text-slate-500 mt-1">Cập nhật ngày giao, note và các size.</p>
                            </div>
                            <button onClick={() => setEditRow(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"><LucideX size={20} /></button>
                        </div>

                        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                            <label className="block">
                                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Ngày giao hàng</span>
                                <input type="date" value={editForm.export_date} onChange={(e) => setEditForm(prev => ({ ...prev, export_date: e.target.value }))} className={`w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all ${!editForm.export_date ? "bg-[#e2e8f0]" : "bg-white"}`} />
                            </label>
                            <label className="block md:col-span-2">
                                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Ghi chú</span>
                                <input value={editForm.note} onChange={(e) => setEditForm(prev => ({ ...prev, note: e.target.value }))} className={`w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all ${!editForm.note ? "bg-[#e2e8f0]" : "bg-white"}`} />
                            </label>
                        </div>

                        <div className="mt-8 grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                            {entrySizes.map((size) => (
                                <label key={size} className="block">
                                    <span className="mb-1 block text-center text-[11px] font-bold text-slate-400">{size}</span>
                                    <input type="number" value={editForm.sizeValues[size] === "0" || !editForm.sizeValues[size] ? "" : editForm.sizeValues[size]} onChange={(e) => setEditForm(prev => ({ ...prev, sizeValues: { ...prev.sizeValues, [size]: e.target.value } }))} className={`w-full rounded-xl border border-slate-200 px-2 py-2 text-center text-[13px] font-bold outline-none focus:border-slate-900 transition-all ${!editForm.sizeValues[size] || editForm.sizeValues[size] === "0" ? "bg-[#e2e8f0]" : "bg-white"}`} />
                                </label>
                            ))}
                        </div>

                        <div className="mt-8 flex justify-end gap-3 border-t border-slate-100 pt-6">
                            <button onClick={() => setEditRow(null)} className="cursor-pointer rounded-xl border border-slate-200 px-6 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors">Hủy</button>
                            <button onClick={saveEdit} className="cursor-pointer rounded-xl bg-slate-950 px-8 py-3 text-sm font-bold text-white hover:bg-slate-800 shadow-lg shadow-slate-200 transition-all">Lưu</button>
                        </div>
                    </div>
                </div>
            )}
            <style jsx global>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div>
    );
}
