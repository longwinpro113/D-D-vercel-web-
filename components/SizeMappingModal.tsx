"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import { Dialog, DialogTitle, DialogContent, Box, TextField, Button, IconButton, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Autocomplete } from "@mui/material";
import { X, Plus, Trash2, ArrowRightLeft } from "lucide-react";
import { sizes } from "@/lib/size";

interface Mapping {
  id?: number;
  client_name: string;
  client_size: string;
  standard_size: string;
}

interface SizeMappingModalProps {
  open: boolean;
  onClose: () => void;
  clientName: string;
  onMappingChanged?: () => void;
}

export function SizeMappingModal({ open, onClose, clientName, onMappingChanged }: SizeMappingModalProps) {
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [newMapping, setNewMapping] = useState({ client_size: "", standard_size: "" });

  const fetchMappings = async () => {
    if (!clientName) return;
    try {
      const res = await axios.get(`/api/size-mappings?client=${encodeURIComponent(clientName)}`);
      setMappings(res.data);
    } catch (err) {
      console.error("Fetch mapping error", err);
    }
  };

  useEffect(() => {
    if (open && clientName) {
      fetchMappings();
    }
  }, [open, clientName]);

  const handleAdd = async () => {
    if (!clientName || !newMapping.client_size || !newMapping.standard_size) return;
    try {
      await axios.post("/api/size-mappings", {
        client_name: clientName,
        client_size: newMapping.client_size,
        standard_size: newMapping.standard_size,
      });
      setNewMapping({ client_size: "", standard_size: "" });
      fetchMappings();
      onMappingChanged?.();
    } catch (err) {
      console.error("Save mapping error", err);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await axios.delete(`/api/size-mappings?id=${id}`);
      fetchMappings();
      onMappingChanged?.();
    } catch (err) {
      console.error("Delete mapping error", err);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth scroll="paper" slotProps={{ paper: { sx: { borderRadius: 4 } } }}>
      <DialogTitle className="flex justify-between items-center border-b pb-4">
        <Box className="flex items-center gap-2">
          <ArrowRightLeft size={20} className="text-blue-600" />
          <Typography variant="h6" className="font-bold">Quy đổi Size: {clientName}</Typography>
        </Box>
        <IconButton onClick={onClose}><X size={20} /></IconButton>
      </DialogTitle>
      <DialogContent className="pt-6">
        <Box className="bg-slate-50 p-4 rounded-xl mb-6 grid grid-cols-2 gap-3 items-end">
          <Box>
            <Typography className="text-[10px] font-bold text-slate-500 mb-1 uppercase">Size Khách (VD: 3S)</Typography>
            <TextField 
              fullWidth size="small" placeholder="3S, 40..." 
              value={newMapping.client_size} 
              onChange={(e) => setNewMapping({ ...newMapping, client_size: e.target.value })}
              sx={{ backgroundColor: 'white' }}
            />
          </Box>
          <Box>
            <Typography className="text-[10px] font-bold text-slate-500 mb-1 uppercase">Size Chuẩn (1-18)</Typography>
            <Autocomplete
              options={sizes.map(String)}
              value={newMapping.standard_size}
              onChange={(_, val) => setNewMapping({ ...newMapping, standard_size: val || "" })}
              renderInput={(params) => <TextField {...params} size="small" placeholder="Chọn..." sx={{ backgroundColor: 'white' }} />}
            />
          </Box>
          <Button 
            fullWidth variant="contained" 
            className="col-span-2 bg-slate-900 hover:bg-slate-800 shadow-none h-10 mt-2"
            onClick={handleAdd}
            startIcon={<Plus size={18} />}
          >
            Thêm quy đổi
          </Button>
        </Box>

        <TableContainer component={Paper} variant="outlined" className="rounded-xl border-slate-200">
          <Table size="small">
            <TableHead className="bg-slate-50">
              <TableRow>
                <TableCell className="font-bold py-3">Size Khách</TableCell>
                <TableCell className="font-bold py-3 text-center">Size Chuẩn</TableCell>
                <TableCell className="font-bold py-3 text-right"></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {mappings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-6 text-slate-400 italic">Chưa có cấu hình</TableCell>
                </TableRow>
              ) : (
                mappings.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-bold text-slate-700">{m.client_size}</TableCell>
                    <TableCell className="text-center">
                      <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md font-bold text-xs">{m.standard_size}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <IconButton size="small" color="error" onClick={() => m.id && handleDelete(m.id)}><Trash2 size={16} /></IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>
    </Dialog>
  );
}
