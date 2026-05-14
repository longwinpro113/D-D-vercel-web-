"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import axios from "axios";
import { entrySizes, sizeToCol, sizes } from "@/lib/size";
import { groupByDate } from "@/lib/shared";
import { useSharedReportClient } from "@/lib/useSharedReportClient";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import { Snackbar, Alert } from "@mui/material";
import { ChevronDown, X as LucideX, Edit, Trash2, Save, RotateCcw, Settings2 } from "lucide-react";
import { FaFilePdf } from "react-icons/fa6";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { SizeMappingModal } from "@/components/SizeMappingModal";

interface SizeMapping {
    client_size: string;
    standard_size: string;
}

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
    100,  // CRD
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
    const [orderRyFilter, setOrderRyFilter] = useState("");
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
    const [mappings, setMappings] = useState<SizeMapping[]>([]);
    const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
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

    const fetchMappings = useCallback(async (clientName: string) => {
        if (!clientName) {
            setMappings([]);
            return;
        }
        try {
            const res = await axios.get(`/api/size-mappings?client=${encodeURIComponent(clientName)}`);
            setMappings(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error("[API] Load mappings error:", err);
        }
    }, []);

    useEffect(() => {
        const loadData = async () => {
            if (!client) {
                setAvailableDates([]);
                setSelectedDate(undefined);
                setMappings([]);
                return;
            }
            
            try {
                const [datesRes, mappingsRes] = await Promise.all([
                    axios.get(`/api/history-export/dates?client=${encodeURIComponent(client)}`),
                    axios.get(`/api/size-mappings?client=${encodeURIComponent(client)}`)
                ]);

                const dates = Array.isArray(datesRes.data) ? (datesRes.data as HistoryDateOption[]) : [];
                setAvailableDates(dates);
                setMappings(Array.isArray(mappingsRes.data) ? mappingsRes.data : []);

                if (dates.length > 0) {
                    setSelectedDate(dates[0].export_date);
                } else {
                    setSelectedDate(undefined);
                }
            } catch (err) {
                console.error("[API] Load client data error:", err);
            }
        };
        void loadData();
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

    const filteredRows = useMemo(() => {
        if (!orderRyFilter) return rows;
        const search = orderRyFilter.toLowerCase();
        return rows.filter(r => 
            (r.ry_number || "").toLowerCase().includes(search) ||
            (r.article || "").toLowerCase().includes(search) ||
            (r.model_name || "").toLowerCase().includes(search)
        );
    }, [rows, orderRyFilter]);

    const grouped = useMemo(
        () => groupByDate(filteredRows) as GroupedDailyReportRows[],
        [filteredRows]
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

    const exportPdf = async (clientName: string) => {
        if (grouped.length === 0) return;
        
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
            const pageHeight = doc.internal.pageSize.getHeight();
            let currentY = 40;

            // --- Header ---
            doc.setFont('Roboto', 'bold');
            doc.setFontSize(16);
            doc.text("BIỂU GIAO THÀNH PHẨM", 30, currentY);
            currentY += 20;
            
            doc.setFont('Roboto', 'normal');
            doc.setFontSize(10);
            doc.text("ĐƠN VỊ CHUYỂN: DD (Long An)", 30, currentY);
            doc.text(`ĐƠN VỊ LÃNH: ${clientName.toUpperCase()}`, pageWidth - 30, currentY, { align: "right" });
            currentY += 30;

            for (let gIdx = 0; gIdx < grouped.length; gIdx++) {
                const group = grouped[gIdx];
                const totalExported = group.rows.reduce((sum, r) => sum + (Number(r.shipped_quantity) || 0), 0);

                if (currentY > pageHeight - 100 && gIdx > 0) {
                    doc.addPage();
                    currentY = 40;
                }

                // Date Sub-header
                doc.setFont('Roboto', 'bold');
                doc.setFontSize(11);
                doc.setTextColor(59, 130, 246);
                doc.text(`NGÀY GIAO: ${group.date}`, 30, currentY);
                doc.setTextColor(0, 0, 0);
                currentY += 15;

                // Determine active sizes
                let activeSizes = entrySizes.filter(s => {
                    return group.rows.some(row => {
                        const val = row[sizeToCol(s)];
                        return (parseFloat(String(val)) || 0) > 0;
                    });
                });
                if (activeSizes.length === 0 && entrySizes.length > 0) activeSizes = [entrySizes[0]];

                const head = [[
                    "STT", "ĐƠN HÀNG", "CRD", "ĐỢT", "MODEL NAME", "SL GIAO", 
                    "CÒN LẠI", "ĐƠN VỊ", "ART", 
                    ...activeSizes.map(s => {
                        const m = mappings.find(map => map.standard_size === String(s));
                        return m ? `${s} (${m.client_size})` : String(s);
                    }), 
                    "GHI CHÚ"
                ]];

                const body = group.rows.map((row, i) => {
                    const isOk = (Number(row.remaining_quantity) || 0) <= 0;
                    return [
                        i + 1,
                        row.ry_number || "",
                        row.CRD || "",
                        row.delivery_round || "",
                        row.model_name || "",
                        row.shipped_quantity ?? 0,
                        isOk ? "OK" : (row.remaining_quantity ?? 0),
                        "ĐÔI",
                        row.article || "",
                        ...activeSizes.map(s => {
                            const val = row[sizeToCol(s as string|number)];
                            return (val && val !== 0 && val !== "0") ? val : "-";
                        }),
                        row.note || ""
                    ];
                });

                autoTable(doc, {
                    startY: currentY,
                    head: head,
                    body: body,
                    theme: 'grid',
                    tableWidth: 'wrap', // Fit content
                    styles: { font: 'Roboto', fontSize: activeSizes.length > 15 ? 7 : 9, cellPadding: 2, valign: 'middle', halign: 'center', lineColor: [100, 100, 100] },
                    headStyles: {
                        fillColor: [241, 245, 249],
                        textColor: [0, 0, 0],
                        fontStyle: 'bold',
                    },
                    margin: { left: 30, right: 30 },
                    didParseCell: (data) => {
                        if (data.column.index === 5 && data.cell.text[0] === 'OK') {
                            data.cell.styles.textColor = [0, 128, 0];
                            data.cell.styles.fontStyle = 'bold';
                        }
                    }
                });

                currentY = (doc as any).lastAutoTable.finalY + 30;
            }

            const fileNameDate = selectedDate ? selectedDate.replace(/\//g, '-') : "All";
            doc.save(`Bieu_Giao_${clientName.replace(/\s+/g, '_')}_${fileNameDate}.pdf`);

        } catch (error: any) {
            console.error("PDF Export error:", error);
            alert("Lỗi xuất PDF: " + error.message);
        }
    };



    if (!isMounted) return null;

    return (
        <div className="mx-auto flex h-[calc(100dvh-80px)] min-h-[calc(100dvh-80px)] w-full flex-col gap-4 p-4 lg:p-6 overflow-hidden bg-slate-50 text-[14px]">
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
                                placeholder="Tất cả các ngày"
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
                        options={Array.from(new Set(rows.map(r => r.ry_number).filter(Boolean)))}
                        value={(orderRyFilter || null) as any}
                        freeSolo
                        popupIcon={autocompletePopupIcon}
                        forcePopupIcon={true}
                        onInputChange={(_, newValue) => setOrderRyFilter(newValue)}
                        onChange={(_, newValue) => setOrderRyFilter(newValue || "")}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                placeholder="Mã đơn hàng..."
                                variant="outlined"
                                sx={{
                                    "& .MuiOutlinedInput-root": {
                                        height: "42px",
                                        borderRadius: "12px",
                                        backgroundColor: "white",
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
                        }}
                    />

                    <button
                        onClick={() => exportPdf(client || "")}
                        className="flex items-center justify-center text-rose-600 hover:text-rose-700 transition-all shrink-0 ml-1"
                        title="Xuất PDF"
                        disabled={!client || rows.length === 0}
                    >
                        <FaFilePdf size={28} className="cursor-pointer" />
                    </button>
                </div>

                <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto rounded-xl border border-slate-200 touch-pan-x overscroll-x-contain report-scrollbar print:border-0 print:overflow-visible">
                    <table className="border-separate border-spacing-0 text-[14px] w-max min-w-full table-auto">
                        <thead className="sticky top-0 z-40 bg-slate-100">
                            <tr className="">
                                <th className="md:sticky md:left-0 top-0 z-30 bg-slate-100 shadow-[inset_-1px_-1px_0_0_#e2e8f0] px-2 py-3 text-center font-bold text-slate-700 w-12">STT</th>
                                <th className="md:sticky md:left-[48px] top-0 z-30 bg-slate-100 shadow-[inset_-1px_-1px_0_0_#e2e8f0] px-3 py-3 text-center font-bold text-slate-700 whitespace-nowrap">Đơn Hàng</th>
                                <th className="md:sticky top-0 bg-slate-100 px-4 py-3 text-center font-bold text-slate-700 whitespace-nowrap border-b border-slate-200">Đợt</th>
                                <th className="md:sticky top-0 bg-slate-100 px-4 py-3 text-center font-bold text-slate-700 whitespace-nowrap border-b border-slate-200">Article</th>
                                <th className="md:sticky top-0 bg-slate-100 px-4 py-3 text-center font-bold text-slate-700 whitespace-nowrap border-b border-slate-200">Model Name</th>
                                <th className="md:sticky top-0 bg-slate-100 px-4 py-3 text-center font-bold text-slate-700 whitespace-nowrap border-b border-slate-200">CRD</th>
                                <th className="md:sticky top-0 bg-slate-100 px-4 py-3 text-center font-bold text-slate-700 whitespace-nowrap border-b border-slate-200">Product</th>
                                <th className="md:sticky top-0 bg-slate-50 px-4 py-3 text-center font-bold text-slate-700 whitespace-nowrap border-b border-slate-200">SL Đơn Hàng</th>
                                <th className="md:sticky top-0 bg-slate-50 px-4 py-3 text-center font-bold text-slate-700 whitespace-nowrap border-b border-slate-200">SL Tích Lũy</th>
                                <th className="md:sticky top-0 bg-slate-50 px-4 py-3 text-center font-bold text-slate-700 whitespace-nowrap border-b border-slate-200">SL Ngày</th>
                                <th className="md:sticky top-0 bg-slate-50 px-4 py-3 text-center font-bold text-slate-700 whitespace-nowrap border-b border-slate-200">SL Còn Lại</th>
                                <th className="md:sticky top-0 bg-slate-100 px-4 py-3 text-center font-bold text-slate-700 whitespace-nowrap border-b border-slate-200">Trạng Thái</th>
                                {entrySizes.map((s) => {
                                    const m = mappings.find(map => map.standard_size === String(s));
                                    return (
                                        <th key={s} className="md:sticky top-0 bg-slate-100 border-b border-r border-slate-200 px-1 py-3 text-center font-bold text-slate-800 w-11">
                                            <div className="flex flex-col leading-tight">
                                                <span>{s}</span>
                                                {m && <span className="text-[10px] text-blue-600 font-medium">({m.client_size})</span>}
                                            </div>
                                        </th>
                                    );
                                })}
                                <th className="md:sticky md:right-0 top-0 z-40 bg-slate-100 border-b border-l border-slate-200 px-3 py-3 text-center font-bold text-slate-700 w-24 print:hidden">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {grouped.map((group) => (
                                <React.Fragment key={group.date}>
                                    <tr className="">
                                        <td className="sticky top-[44px] left-0 z-30 bg-[#f8fafc] border-b border-slate-100 h-10 shadow-[inset_-1px_0_0_0_#e2e8f0]"></td>
                                        <td className="sticky top-[44px] left-[48px] z-30 bg-[#f8fafc] border-b border-slate-100 h-10 shadow-[inset_-1px_0_0_0_#e2e8f0] px-3 py-2 text-center font-bold text-blue-600 uppercase tracking-wider text-[13px] whitespace-nowrap">
                                            {group.date}
                                        </td>
                                        <td colSpan={11 + entrySizes.length} className="sticky top-[44px] z-20 bg-[#f8fafc] border-b border-slate-100 px-4 py-2"></td>
                                    </tr>
                                    {group.rows.map((row, index) => {
                                        const status = (row.remaining_quantity ?? 0) === 0 ? "Ok" : "Not Ok";
                                        const rowBg = index % 2 === 0 ? "bg-white" : "bg-slate-50";
                                        return (
                                            <tr key={row.id} className={`${rowBg} hover:bg-blue-50/20 transition-colors group`}>
                                                <td className={`md:sticky md:left-0 z-10 shadow-[inset_-1px_-1px_0_0_#e2e8f0] px-3 py-2.5 font-bold text-slate-800 text-center whitespace-nowrap ${rowBg} group-hover:bg-blue-50`}>
                                                    {index + 1}
                                                </td>
                                                <td className={`md:sticky md:left-[48px] z-10 shadow-[inset_-1px_-1px_0_0_#e2e8f0] px-3 py-2.5 font-bold text-slate-900 text-center whitespace-nowrap ${rowBg} group-hover:bg-blue-50`}>
                                                    {row.ry_number}
                                                </td>
                                                <td className="border-b border-r border-slate-100 px-3 py-2.5 font-bold text-orange-600 text-center whitespace-nowrap">{row.delivery_round || "-"}</td>
                                                <td className="border-b border-r border-slate-100 px-3 py-2.5 font-bold text-[#e59f67] text-center whitespace-nowrap">{row.article || "-"}</td>
                                                <td className="border-b border-r border-slate-100 px-3 py-2.5 font-bold text-[#e59f67] text-center whitespace-nowrap">{row.model_name || "-"}</td>
                                                <td className="border-b border-r border-slate-100 px-3 py-2.5 font-bold text-blue-600 text-center whitespace-nowrap">{row.CRD || "-"}</td>
                                                <td className="border-b border-r border-slate-100 px-3 py-2.5 font-bold text-[#e59f67] text-center whitespace-nowrap">{row.product || "-"}</td>
                                                <td className="border-b border-r border-slate-100 px-3 py-2.5 font-bold text-[#3b82f6] text-center whitespace-nowrap">{row.total_quantity || 0}</td>
                                                <td className="border-b border-r border-slate-100 px-3 py-2.5 font-bold text-[#a855f7] text-center whitespace-nowrap">{row.accumulated_total || 0}</td>
                                                <td className="border-b border-r border-slate-100 px-3 py-2.5 font-bold text-[#0284c7] text-center whitespace-nowrap">{row.shipped_quantity || 0}</td>
                                                <td className={`border-b border-r border-slate-100 px-3 py-2.5 font-bold text-center whitespace-nowrap ${row.remaining_quantity === 0 ? "text-[#16a34a]" : "text-[#ef4444]"}`}>
                                                    {row.remaining_quantity || 0}
                                                </td>
                                                <td className={`px-0 py-0 border-b border-r border-slate-100 whitespace-nowrap text-center align-middle ${status === 'Ok' ? 'bg-emerald-50 text-emerald-600' : 'bg-[#fee2e2] text-rose-600'}`}>
                                                    <div className="w-full h-full min-h-[44px] flex items-center justify-center font-bold text-[13px] whitespace-nowrap">
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

            <SizeMappingModal 
                open={isMappingModalOpen} 
                onClose={() => setIsMappingModalOpen(false)} 
                clientName={client || ""}
                onMappingChanged={() => {
                    axios.get(`/api/size-mappings?client=${encodeURIComponent(client || "")}`).then((res) => {
                        setMappings(Array.isArray(res.data) ? res.data : []);
                    });
                }}
            />

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
                            <label className="block md:col-span-1">
                                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Ghi chú</span>
                                <input value={editForm.note} onChange={(e) => setEditForm(prev => ({ ...prev, note: e.target.value }))} className={`w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all ${!editForm.note ? "bg-[#e2e8f0]" : "bg-white"}`} />
                            </label>
                            <label className="block md:col-span-1">
                                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Quy đổi Size</span>
                                <button 
                                    onClick={() => setIsMappingModalOpen(true)}
                                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Settings2 size={16} /> Thiết lập
                                </button>
                            </label>
                        </div>

                        <div className="mt-8 grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                            {entrySizes.map((size) => {
                                const m = mappings.find(map => map.standard_size === String(size));
                                return (
                                    <label key={size} className="block">
                                        <span className="mb-1 flex flex-col items-center text-[10px] font-bold text-slate-400">
                                            <span>{size}</span>
                                            {m && <span className="text-blue-600">({m.client_size})</span>}
                                        </span>
                                        <input type="number" value={editForm.sizeValues[size] === "0" || !editForm.sizeValues[size] ? "" : editForm.sizeValues[size]} onChange={(e) => setEditForm(prev => ({ ...prev, sizeValues: { ...prev.sizeValues, [size]: e.target.value } }))} className={`w-full rounded-xl border border-slate-200 px-2 py-2 text-center text-[13px] font-bold outline-none focus:border-slate-900 transition-all ${!editForm.sizeValues[size] || editForm.sizeValues[size] === "0" ? "bg-[#e2e8f0]" : "bg-white"}`} />
                                    </label>
                                );
                            })}
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
