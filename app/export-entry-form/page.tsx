"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import type { Dayjs } from "dayjs";
import { Snackbar, Alert, type AlertColor } from "@mui/material";
import axios from "axios";
import { entrySizes, sizeToCol } from "@/lib/size";
import { ArrowRightLeft, Settings2, X as LucideX, ChevronDown, Save, RotateCcw } from "lucide-react";
import { SizeMappingModal } from "@/components/SizeMappingModal";

interface SizeMapping {
    client_size: string;
    standard_size: string;
}
import { getErrorMessage, type ClientRow } from "@/lib/types";

type OrderRecord = {
    ry_number: string;
    article?: string;
    model_name?: string;
    product?: string;
    delivery_round?: string | null;
    CRD?: string | null;
};

type ErrorShape = {
    response?: { data?: { error?: string }; };
    message?: string;
};

type RequiredFieldKey = "client" | "exportDate" | "orderRy";

const autocompletePopupIcon = <ChevronDown size={16} />;

export default function ExportEntryFormPage() {
    const [exportDate, setExportDate] = useState<Dayjs | null>(null);
    const [client, setClient] = useState("");
    const [orderRy, setOrderRy] = useState("");
    const [note, setNote] = useState("");
    const [sizeValues, setSizeValues] = useState<Record<string, string>>({});
    const [clients, setClients] = useState<string[]>([]);
    const [orders, setOrders] = useState<OrderRecord[]>([]);
    const [missingRequiredFields, setMissingRequiredFields] = useState<RequiredFieldKey[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: AlertColor }>({
        open: false,
        message: "",
        severity: "success",
    });
    const [mappings, setMappings] = useState<SizeMapping[]>([]);
    const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
    const [isClientInputMode, setIsClientInputMode] = useState(false);
    const [clientSizeValues, setClientSizeValues] = useState<Record<string, string>>({});

    useEffect(() => {
        axios.get("/api/orders/clients").then((res) => {
            setClients(Array.isArray(res.data) ? (res.data as ClientRow[]).map(c => c.client).filter((c): c is string => Boolean(c)) : []);
        }).catch(err => console.error("[API] Load clients error:", err));
    }, []);

    useEffect(() => {
        if (!client) {
            setOrders([]);
            return;
        }
        axios.get(`/api/orders?client=${encodeURIComponent(client)}`).then((res) => {
            setOrders(Array.isArray(res.data) ? (res.data as OrderRecord[]) : []);
        }).catch(err => console.error("[API] Load orders error:", err));

        // Fetch Size Mappings
        const loadMappings = () => {
            axios.get(`/api/size-mappings?client=${encodeURIComponent(client)}`).then((res) => {
                const data = Array.isArray(res.data) ? res.data : [];
                setMappings(data);
                // Reset client values
                const initialClientValues: Record<string, string> = {};
                data.forEach(m => {
                    initialClientValues[m.client_size] = "";
                });
                setClientSizeValues(initialClientValues);
            }).catch(() => setMappings([]));
        };
        loadMappings();
    }, [client]);

    const handleClientSizeChange = useCallback((clientSize: string, value: string) => {
        setClientSizeValues(prev => ({ ...prev, [clientSize]: value }));
        const mapping = mappings.find(m => m.client_size === clientSize);
        if (mapping) {
            setSizeValues(prev => ({ ...prev, [mapping.standard_size]: value }));
        }
    }, [mappings]);

    const selectedOrder = useMemo(() => orders.find(o => o.ry_number === orderRy) || null, [orderRy, orders]);

    const totalSize = useMemo(() => entrySizes.reduce((sum, size) => sum + (parseFloat(sizeValues[size]) || 0), 0), [sizeValues]);

    const handleCloseSnackbar = (_?: React.SyntheticEvent | Event, reason?: string) => {
        if (reason === "clickaway") return;
        setSnackbar(prev => ({ ...prev, open: false }));
    };

    const getSharedTextFieldSx = (value: any) => ({
        "& .MuiOutlinedInput-root": {
            borderRadius: 2,
            backgroundColor: !value ? "#e2e8f0" : "#ffffff",
            "& input, & textarea": { color: value ? "#000" : "inherit", fontWeight: value ? "600" : "normal" },
            "& input.Mui-disabled, & textarea.Mui-disabled": {
                WebkitTextFillColor: value ? "#000" : "inherit",
                opacity: 1,
            },
            "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#000" },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#000" },
        },
        "& .MuiInputLabel-root.Mui-focused": { color: "#000" },
    });

    const handleReset = () => {
        setExportDate(null);
        setClient("");
        setOrderRy("");
        setNote("");
        setSizeValues({});
        setMissingRequiredFields([]);
    };

    const requiredLabel = (label: string, key: RequiredFieldKey) => (
        <><span>{label}</span><span className={missingRequiredFields.includes(key) ? "text-rose-500" : "text-slate-400"}> *</span></>
    );

    const updateRequiredField = (key: RequiredFieldKey, value: string) => {
        if (key === "client") { setClient(value); setOrderRy(""); }
        else if (key === "orderRy") { setOrderRy(value); }
        setMissingRequiredFields(prev => value.trim() ? prev.filter(k => k !== key) : prev);
    };

    const handleSave = async () => {
        const missing: RequiredFieldKey[] = [];
        if (!client.trim()) missing.push("client");
        if (!exportDate) missing.push("exportDate");
        if (!selectedOrder?.ry_number) missing.push("orderRy");
        setMissingRequiredFields(missing);
        if (missing.length > 0) {
            setSnackbar({ open: true, message: "Vui lòng chọn khách hàng, ngày giao hàng và đơn hàng.", severity: "error" });
            return;
        }
        setIsSaving(true);
        try {
            const payload = {
                export_date: exportDate!.format("YYYY-MM-DD"),
                client,
                ry_number: selectedOrder!.ry_number,
                delivery_round: selectedOrder!.delivery_round || null,
                note: note.trim() || null,
                ...Object.fromEntries(entrySizes.map(s => [sizeToCol(s), parseFloat(sizeValues[s]) || 0]))
            };
            await axios.post("/api/history-export", payload);
            setSnackbar({ open: true, message: "Lưu báo cáo xuất hàng thành công.", severity: "success" });
            handleReset();
        } catch (error) {
            const err = error as ErrorShape;
            setSnackbar({ open: true, message: err.response?.data?.error || "Lưu thất bại.", severity: "error" });
        } finally { setIsSaving(false); }
    };

    return (
        <Box className="w-full h-[calc(100dvh-80px)] min-h-[calc(100dvh-80px)] overflow-hidden bg-gray-50 p-2 lg:p-4 text-gray-800 flex flex-col">
            <Box className="w-full min-h-0 bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex-1 flex flex-col overflow-y-auto no-scrollbar">
                <Box className="flex justify-between items-center mb-3 shrink-0"><h1 className="text-xl font-bold text-black">Nhập Thông Tin Xuất Hàng</h1></Box>
                <LocalizationProvider dateAdapter={AdapterDayjs}>
                    <Box component="section" sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(3, minmax(0, 1fr))" }, gap: 2, mb: 4 }}>
                        <Autocomplete 
                            options={clients} 
                            value={client || null} 
                            onChange={(_, v) => updateRequiredField("client", v || "")} 
                            onInputChange={(_, v) => updateRequiredField("client", v)}
                            slotProps={{ listbox: { style: { maxHeight: 200 } } }}
                            renderInput={(params) => <TextField {...params} label={requiredLabel("Khách hàng", "client")} variant="outlined" fullWidth sx={getSharedTextFieldSx(client)} />} 
                        />
                        <DatePicker label={requiredLabel("Ngày giao hàng", "exportDate")} value={exportDate} onChange={(v) => { setExportDate(v); if (v) setMissingRequiredFields(p => p.filter(k => k !== "exportDate")); }} format="DD/MM/YYYY" slotProps={{ textField: { fullWidth: true, sx: getSharedTextFieldSx(exportDate?.toString()) } }} />
                        <Autocomplete 
                            options={orders.map(o => o.ry_number)} 
                            value={orderRy || null} 
                            disabled={!client || orders.length === 0} 
                            onChange={(_, v) => updateRequiredField("orderRy", v || "")} 
                            onInputChange={(_, v) => updateRequiredField("orderRy", v)}
                            slotProps={{ listbox: { style: { maxHeight: 200 } } }}
                            renderInput={(params) => <TextField {...params} label={requiredLabel("Đơn hàng", "orderRy")} variant="outlined" fullWidth sx={getSharedTextFieldSx(orderRy)} />} 
                        />
                        <TextField label="Article" variant="outlined" fullWidth value={selectedOrder?.article || ""} disabled sx={getSharedTextFieldSx(selectedOrder?.article)} />
                        <TextField label="Model Name" variant="outlined" fullWidth value={selectedOrder?.model_name || ""} disabled sx={getSharedTextFieldSx(selectedOrder?.model_name)} />
                        <TextField label="Product" variant="outlined" fullWidth value={selectedOrder?.product || ""} disabled sx={getSharedTextFieldSx(selectedOrder?.product)} />
                        <TextField label="CRD" variant="outlined" fullWidth value={selectedOrder?.CRD || ""} disabled sx={getSharedTextFieldSx(selectedOrder?.CRD)} />
                        <TextField label="Đợt Xuống Hàng" variant="outlined" fullWidth value={selectedOrder?.delivery_round || ""} disabled sx={getSharedTextFieldSx(selectedOrder?.delivery_round)} />
                        <TextField label="Ghi chú" variant="outlined" fullWidth multiline maxRows={3} value={note} onChange={(e) => setNote(e.target.value)} sx={getSharedTextFieldSx(note)} />
                    </Box>
                </LocalizationProvider>

                <Box className="flex-1 flex min-h-0 flex-col overflow-hidden mt-4">
                    <Box className="flex items-center gap-4 mb-4 shrink-0">
                        <h2 className="text-lg font-bold text-black border-none m-0">
                            {isClientInputMode ? "Nhập số lượng theo size khách" : "Nhập số lượng size chuẩn"}
                        </h2>
                        <Box className={`rounded-xl bg-black px-4 py-2 text-[15px] font-bold text-white shadow-sm transition-opacity duration-200 ${totalSize > 0 ? "opacity-100" : "opacity-0"}`}>Tổng: {totalSize}</Box>
                        
                        <Box className="ml-auto flex items-center gap-2">
                            <button 
                                onClick={() => setIsMappingModalOpen(true)}
                                disabled={!client}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                                    !client 
                                    ? "bg-slate-50 text-slate-300 cursor-not-allowed border border-slate-100" 
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                }`}
                                title={!client ? "Vui lòng chọn khách hàng trước" : "Cài đặt quy đổi size cho khách hàng này"}
                            >
                                <Settings2 size={16} />
                                Cài đặt quy đổi
                            </button>

                            <button 
                                onClick={() => setIsClientInputMode(!isClientInputMode)}
                                disabled={!client || mappings.length === 0}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                                    (!client || mappings.length === 0)
                                    ? "bg-slate-50 text-slate-300 cursor-not-allowed border border-slate-100"
                                    : (isClientInputMode ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600 hover:bg-blue-100')
                                }`}
                                title={!client ? "Vui lòng chọn khách hàng trước" : (mappings.length === 0 ? "Khách hàng này chưa có cấu hình quy đổi" : "")}
                            >
                                <ArrowRightLeft size={16} />
                                {isClientInputMode ? "Ẩn Quy đổi" : "Nhập theo size khách"}
                            </button>
                        </Box>
                    </Box>
                    <Box className="grid flex-1 min-h-0 grid-cols-3 gap-x-3 gap-y-5 overflow-y-auto pr-1 pt-1 pb-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 no-scrollbar">
                        {isClientInputMode ? (
                            mappings.map((m) => (
                                <Box key={m.client_size} className="flex flex-col items-center">
                                    <span className="text-[12px] font-semibold mb-1 text-gray-700 leading-none flex flex-col items-center justify-center h-7">
                                        <span>{m.client_size}</span>
                                        <span className="text-[10px] text-blue-600 font-bold leading-none mt-0.5">({m.standard_size})</span>
                                    </span>
                                    <input 
                                        type="number" 
                                        value={clientSizeValues[m.client_size] || ""} 
                                        onChange={(e) => handleClientSizeChange(m.client_size, e.target.value)} 
                                        className={`w-full h-12 px-2 border border-blue-200 rounded-lg text-center text-lg font-semibold focus:outline-none focus:border-blue-600 transition-all ${!clientSizeValues[m.client_size] ? "bg-blue-50/30" : "bg-white"}`} 
                                    />
                                </Box>
                            ))
                        ) : (
                            entrySizes.map((s) => {
                                const m = mappings.find(map => map.standard_size === String(s));
                                return (
                                    <Box key={s} className="flex flex-col items-center">
                                        <span className="text-[12px] font-semibold mb-1 text-gray-700 leading-none flex flex-col items-center justify-center h-7">
                                            <span>{s}</span>
                                            {m ? (
                                                <span className="text-[10px] text-blue-600 font-bold leading-none mt-0.5">({m.client_size})</span>
                                            ) : (
                                                <span className="h-[10px]" />
                                            )}
                                        </span>
                                        <input type="number" value={sizeValues[s] || ""} onChange={(e) => setSizeValues(p => ({ ...p, [s]: e.target.value }))} className={`w-full h-12 px-2 border border-gray-200 rounded-lg text-center text-lg font-semibold focus:outline-none focus:border-black transition-all ${!sizeValues[s] ? "bg-gray-100" : "bg-white"}`} />
                                    </Box>
                                );
                            })
                        )}
                    </Box>
                </Box>
                <Box className="flex gap-4 mt-2 pt-4 border-t border-gray-100 shrink-0">
                    <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2 bg-black hover:bg-gray-800 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg font-semibold transition-colors shadow-sm text-sm"><Save size={16} />{isSaving ? "Đang lưu..." : "Lưu Báo Cáo"}</button>
                    <button onClick={handleReset} disabled={isSaving} className="flex items-center gap-2 bg-white border border-black text-black hover:bg-gray-50 disabled:border-gray-300 disabled:text-gray-300 px-6 py-2 rounded-lg font-semibold transition-colors text-sm"><RotateCcw size={16} />Làm mới</button>
                </Box>
            </Box>
            <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={handleCloseSnackbar} anchorOrigin={{ vertical: "bottom", horizontal: "right" }}><Alert onClose={handleCloseSnackbar} severity={snackbar.severity} variant="filled" sx={{ width: "100%" }}>{snackbar.message}</Alert></Snackbar>
            
            <SizeMappingModal 
                open={isMappingModalOpen} 
                onClose={() => setIsMappingModalOpen(false)} 
                clientName={client}
                onMappingChanged={() => {
                    axios.get(`/api/size-mappings?client=${encodeURIComponent(client)}`).then((res) => {
                        setMappings(Array.isArray(res.data) ? res.data : []);
                    });
                }}
            />
            <style jsx global>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                input[type='number']::-webkit-inner-spin-button,
                input[type='number']::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
                input[type='number'] { -moz-appearance: textfield; }
            `}</style>
        </Box>
    );
}
