"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import type { Dayjs } from "dayjs";
import { Snackbar, Alert, type AlertColor, Typography, IconButton } from "@mui/material";
import axios from "axios";
import { entrySizes, sizeToCol } from "@/lib/size";
import { ArrowRightLeft, X as LucideX, Settings2, Save, RotateCcw } from "lucide-react";
import { SizeMappingModal } from "@/components/SizeMappingModal";

interface SizeMapping {
    client_size: string;
    standard_size: string;
}

type RequiredFieldKey = "customer" | "article" | "order" | "delivery";

const defaultProductOptions = ["BTP Chặt", "BTP In", "TP Laban", "TP Quai", "TP Lưỡi Gà"];

export default function OrdersEntryFormPage() {
    const [exportPortDate, setExportPortDate] = useState<Dayjs | null>(null);
    const [exportGoodsDate, setExportGoodsDate] = useState<Dayjs | null>(null);
    const [importGoodsDate, setImportGoodsDate] = useState<Dayjs | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: AlertColor }>({
        open: false,
        message: "",
        severity: "success",
    });

    const [formValues, setFormValues] = useState({
        customer: "",
        article: "",
        order: "",
        delivery: "",
        modelName: "",
        product: "",
    });

    const [clientOptions, setClientOptions] = useState<string[]>([]);
    const [articleOptions, setArticleOptions] = useState<string[]>([]);
    const [orderOptions, setOrderOptions] = useState<string[]>([]);
    const [modelOptions, setModelOptions] = useState<string[]>([]);
    const [productOptions, setProductOptions] = useState<string[]>(defaultProductOptions);
    const [sizeValues, setSizeValues] = useState<Record<string, string>>({});
    const [missingRequiredFields, setMissingRequiredFields] = useState<RequiredFieldKey[]>([]);
    
    // Size Mapping Logic
    const [mappings, setMappings] = useState<SizeMapping[]>([]);
    const [clientSizeValues, setClientSizeValues] = useState<Record<string, string>>({});
    const [showConversion, setShowConversion] = useState(false);
    const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);

    const totalSize = useMemo(
        () => entrySizes.reduce((sum, size) => sum + (parseFloat(sizeValues[size]) || 0), 0),
        [sizeValues],
    );

    const handleCloseSnackbar = (_?: React.SyntheticEvent | Event, reason?: string) => {
        if (reason === "clickaway") return;
        setSnackbar((prev) => ({ ...prev, open: false }));
    };

    useEffect(() => {
        axios.get("/api/suggestions?field=client").then((res) => {
            setClientOptions(Array.isArray(res.data) ? (res.data as string[]) : []);
        }).catch((err) => console.error("[API] Error fetching clients:", err));
    }, []);

    useEffect(() => {
        if (!formValues.customer) {
            setArticleOptions([]);
            setOrderOptions([]);
            setModelOptions([]);
            setProductOptions(defaultProductOptions);
            return;
        }

        const fetchField = (field: string, setter: (val: string[]) => void) => {
            axios.get(`/api/suggestions?field=${field}&client=${encodeURIComponent(formValues.customer)}`).then((res) => {
                setter(Array.isArray(res.data) ? (res.data as string[]) : []);
            }).catch((err) => console.error(`[API] Error fetching ${field}:`, err));
        };

        fetchField("article", setArticleOptions);
        fetchField("ry_number", setOrderOptions);
        fetchField("model_name", setModelOptions);
        fetchField("product", (items) => setProductOptions(Array.from(new Set([...defaultProductOptions, ...items]))));

        // Fetch Size Mappings for the selected client
        const loadMappings = () => {
            axios.get(`/api/size-mappings?client=${encodeURIComponent(formValues.customer)}`).then((res) => {
                setMappings(Array.isArray(res.data) ? res.data : []);
            }).catch(() => setMappings([]));
        };
        loadMappings();
        (window as any).refreshMappings = loadMappings; // Optional helper
    }, [formValues.customer]);

    const handleClientSizeChange = useCallback((clientSize: string, value: string) => {
        setClientSizeValues(prev => ({ ...prev, [clientSize]: value }));
        
        // Find corresponding standard size
        const mapping = mappings.find(m => m.client_size === clientSize);
        if (mapping) {
            setSizeValues(prev => ({ ...prev, [mapping.standard_size]: value }));
        }
    }, [mappings]);

    const handleReset = () => {
        setExportPortDate(null);
        setExportGoodsDate(null);
        setImportGoodsDate(null);
        setMissingRequiredFields([]);
        setFormValues({ customer: "", article: "", order: "", delivery: "", modelName: "", product: "" });
        setSizeValues({});
        setClientSizeValues({});
        setShowConversion(false);
    };

    const requiredLabel = (label: string, key: RequiredFieldKey) => (
        <>
            <span>{label}</span>
            <span className={missingRequiredFields.includes(key) ? "text-rose-500" : "text-slate-400"}> *</span>
        </>
    );

    const updateRequiredField = useCallback((key: RequiredFieldKey, value: string) => {
        setFormValues((prev) => ({ ...prev, [key]: value }));
        setMissingRequiredFields((prev) => (value.trim() ? prev.filter((item) => item !== key) : prev));
    }, []);

    const handleSave = async () => {
        const required = ["customer", "article", "order", "delivery"] as const;
        const missing = required.filter(k => !formValues[k]);
        setMissingRequiredFields(missing as RequiredFieldKey[]);
        if (missing.length > 0) {
            setSnackbar({ open: true, message: "Vui lòng nhập đầy đủ các trường bắt buộc.", severity: "error" });
            return;
        }

        const enteredSizes = Object.entries(sizeValues).filter(([, val]) => parseFloat(val) > 0);
        if (enteredSizes.length === 0) {
            setSnackbar({ open: true, message: "Vui lòng nhập số lượng size.", severity: "error" });
            return;
        }

        setIsSaving(true);
        try {
            const totalQty = enteredSizes.reduce((acc, [, val]) => acc + (parseFloat(val) || 0), 0);
            const payload: Record<string, string | number | null> = {
                client: formValues.customer,
                article: formValues.article,
                ry_number: formValues.order,
                delivery_round: formValues.delivery,
                model_name: formValues.modelName,
                product: formValues.product,
                CRD: exportPortDate?.format("YYYY-MM-DD") || null,
                client_export_date: exportGoodsDate?.format("YYYY-MM-DD") || null,
                client_import_date: importGoodsDate?.format("YYYY-MM-DD") || null,
                total_order_qty: totalQty,
            };
            entrySizes.forEach((size) => { payload[sizeToCol(size)] = parseFloat(sizeValues[size]) || 0; });
            await axios.post("/api/orders", payload);
            setSnackbar({ open: true, message: "Lưu đơn hàng thành công!", severity: "success" });
            handleReset();
        } catch (error: any) {
            console.error("[API] Error saving order:", error);
            const isDuplicate = error.response?.status === 409 || error.response?.data?.error === "DUPLICATE_ENTRY";
            const serverError = error.response?.data?.message || error.response?.data?.error || "Lỗi không xác định";
            setSnackbar({ 
                open: true, 
                message: isDuplicate ? "Dữ liệu đã tồn tại (mã PO/RY này đã có)." : `Lỗi khi lưu: ${serverError}`, 
                severity: "error" 
            });
        } finally {
            setIsSaving(false);
        }
    };

    const getSharedTextFieldSx = (value: string | null | undefined) => ({
        "& .MuiOutlinedInput-root": {
            borderRadius: 2,
            backgroundColor: !value ? "#e2e8f0" : "#ffffff",
            "& input, & textarea": { color: value ? "#000" : "inherit", fontWeight: value ? "600" : "normal" },
            "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#000" },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#000" },
        },
        "& .MuiInputLabel-root.Mui-focused": { color: "#000" },
    });

    return (
        <Box className="w-full h-[calc(100dvh-80px)] min-h-[calc(100dvh-80px)] overflow-hidden bg-gray-50 p-2 lg:p-4 text-gray-800 flex flex-col">
            <Box className="w-full min-h-0 bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex-1 flex flex-col overflow-y-auto no-scrollbar">
                <Box className="flex justify-between items-center mb-3 shrink-0">
                    <h1 className="text-xl font-bold text-black">Nhập Thông Tin Đơn Hàng Mới</h1>
                </Box>

                <LocalizationProvider dateAdapter={AdapterDayjs}>
                    <Box component="section" sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(3, minmax(0, 1fr))" }, gap: 2, mb: 4 }}>
                        {[
                            { label: "Khách hàng", key: "customer", options: clientOptions, mandatory: true },
                            { label: "Article", key: "article", options: articleOptions, mandatory: true },
                            { label: "Ry (PO)", key: "order", options: orderOptions, mandatory: true },
                            { label: "Model Name", key: "modelName", options: modelOptions, mandatory: false },
                            { label: "Sản Phẩm", key: "product", options: productOptions, mandatory: false },
                            { label: "Đợt Xuống Hàng", key: "delivery", options: (formValues.customer ? Array.from({ length: 10 }, (_, i) => `DHD${i + 1}`) : []), mandatory: true }
                        ].map((field) => (
                            <Autocomplete
                                key={field.key}
                                freeSolo={field.key !== "delivery"}
                                options={field.options}
                                value={formValues[field.key as keyof typeof formValues] || null}
                                onChange={(_, newValue) => updateRequiredField(field.key as RequiredFieldKey, newValue || "")}
                                onInputChange={(_, newInputValue) => updateRequiredField(field.key as RequiredFieldKey, newInputValue)}
                                slotProps={{ listbox: { style: { maxHeight: 200 } } }}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label={field.mandatory ? requiredLabel(field.label, field.key as RequiredFieldKey) : field.label}
                                        variant="outlined"
                                        fullWidth
                                        sx={getSharedTextFieldSx(formValues[field.key as keyof typeof formValues])}
                                    />
                                )}
                            />
                        ))}

                        <DatePicker label="CRD (Ngày Xuất Cảng)" value={exportPortDate} onChange={(v) => setExportPortDate(v)} format="DD/MM/YYYY" slotProps={{ textField: { fullWidth: true, sx: getSharedTextFieldSx(exportPortDate?.toString()) } }} />
                        <DatePicker label="Ngày Xuất Kho" value={exportGoodsDate} onChange={(v) => setExportGoodsDate(v)} format="DD/MM/YYYY" slotProps={{ textField: { fullWidth: true, sx: getSharedTextFieldSx(exportGoodsDate?.toString()) } }} />
                        <DatePicker label="Ngày Nhập Kho" value={importGoodsDate} onChange={(v) => setImportGoodsDate(v)} format="DD/MM/YYYY" slotProps={{ textField: { fullWidth: true, sx: getSharedTextFieldSx(importGoodsDate?.toString()) } }} />
                    </Box>
                </LocalizationProvider>

                <Box className="flex-1 flex min-h-0 flex-col overflow-hidden">
                    <Box className="flex items-center gap-4 mb-4 shrink-0">
                        <h2 className="text-lg font-bold text-black border-none m-0">Nhập số lượng size</h2>
                        <Box className={`rounded-xl bg-black px-4 py-2 text-[15px] font-bold text-white shadow-sm transition-opacity duration-200 ${totalSize > 0 ? "opacity-100" : "opacity-0"}`}>Tổng: {totalSize}</Box>
                        
                        <Box className="ml-auto flex items-center gap-2">
                            <button 
                                onClick={() => setIsMappingModalOpen(true)}
                                disabled={!formValues.customer}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                                    !formValues.customer 
                                    ? "bg-slate-50 text-slate-300 cursor-not-allowed border border-slate-100" 
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                }`}
                                title={!formValues.customer ? "Vui lòng chọn khách hàng trước" : "Cài đặt quy đổi size cho khách hàng này"}
                            >
                                <Settings2 size={16} />
                                Cài đặt quy đổi
                            </button>

                            <button 
                                onClick={() => setShowConversion(!showConversion)}
                                disabled={!formValues.customer || mappings.length === 0}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                                    (!formValues.customer || mappings.length === 0)
                                    ? "bg-slate-50 text-slate-300 cursor-not-allowed border border-slate-100"
                                    : (showConversion ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600 hover:bg-blue-100')
                                }`}
                                title={!formValues.customer ? "Vui lòng chọn khách hàng trước" : (mappings.length === 0 ? "Khách hàng này chưa có cấu hình quy đổi" : "")}
                            >
                                <ArrowRightLeft size={16} />
                                {showConversion ? "Ẩn Quy đổi" : "Nhập theo size khách"}
                            </button>
                        </Box>
                    </Box>

                    {showConversion && mappings.length > 0 && (
                        <Box className="mb-6 p-4 bg-blue-50/50 rounded-xl border border-blue-100 animate-in fade-in slide-in-from-top-2 duration-300">
                            <Box className="flex items-center justify-between mb-3">
                                <Typography className="text-sm font-bold text-blue-800 flex items-center gap-2">
                                    <ArrowRightLeft size={14} /> Quy đổi cho khách: {formValues.customer}
                                </Typography>
                                <IconButton size="small" onClick={() => setShowConversion(false)}><LucideX size={14} /></IconButton>
                            </Box>
                            <Box className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                                {mappings.map((m) => (
                                    <Box key={m.client_size} className="flex flex-col items-center">
                                        <span className="text-[11px] font-bold text-blue-600 mb-0.5 whitespace-nowrap">Size {m.client_size} (➔ {m.standard_size})</span>
                                        <input 
                                            type="number" 
                                            value={clientSizeValues[m.client_size] || ""} 
                                            onChange={(e) => handleClientSizeChange(m.client_size, e.target.value)}
                                            placeholder="-"
                                            className="w-full h-10 px-2 border border-blue-200 rounded-lg text-center text-sm font-bold bg-white focus:outline-none focus:border-blue-500 transition-all shadow-sm" 
                                        />
                                    </Box>
                                ))}
                            </Box>
                        </Box>
                    )}
                    <Box className="grid flex-1 min-h-0 grid-cols-3 gap-x-3 gap-y-5 overflow-y-auto pr-1 pt-1 pb-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 no-scrollbar">
                        {entrySizes.map((size) => {
                            const m = mappings.find(map => map.standard_size === String(size));
                            return (
                                <Box key={size} className="flex flex-col items-center">
                                    <span className="text-[12px] font-semibold mb-1 text-gray-700 leading-none flex flex-col items-center justify-center h-7">
                                        <span>{size}</span>
                                        {m ? (
                                            <span className="text-[10px] text-blue-600 font-bold leading-none mt-0.5">({m.client_size})</span>
                                        ) : (
                                            <span className="h-[10px]" /> 
                                        )}
                                    </span>
                                    <input type="number" value={sizeValues[size] || ""} onChange={(e) => setSizeValues((prev) => ({ ...prev, [size]: e.target.value }))} className={`w-full h-12 px-2 border border-gray-200 rounded-lg text-center text-lg font-semibold focus:outline-none focus:border-black transition-all ${!sizeValues[size] ? "bg-gray-100" : "bg-white"}`} />
                                </Box>
                            );
                        })}
                    </Box>
                </Box>

                <Box className="flex gap-4 mt-2 pt-4 border-t border-gray-100 shrink-0">
                    <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2 bg-black hover:bg-gray-800 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg font-semibold transition-colors shadow-sm text-sm"><Save size={16} />{isSaving ? "Đang lưu..." : "Lưu Đơn Hàng"}</button>
                    <button onClick={handleReset} disabled={isSaving} className="flex items-center gap-2 bg-white border border-black text-black hover:bg-gray-50 px-6 py-2 rounded-lg font-semibold transition-colors text-sm"><RotateCcw size={16} />Làm mới</button>
                </Box>
            </Box>
            <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={handleCloseSnackbar} anchorOrigin={{ vertical: "bottom", horizontal: "right" }}><Alert onClose={handleCloseSnackbar} severity={snackbar.severity} variant="filled" sx={{ width: "100%" }}>{snackbar.message}</Alert></Snackbar>
            
            <SizeMappingModal 
                open={isMappingModalOpen} 
                onClose={() => setIsMappingModalOpen(false)} 
                clientName={formValues.customer}
                onMappingChanged={() => {
                    axios.get(`/api/size-mappings?client=${encodeURIComponent(formValues.customer)}`).then((res) => {
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
