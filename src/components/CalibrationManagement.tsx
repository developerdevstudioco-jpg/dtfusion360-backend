import React, { useState, useRef, useEffect } from 'react';
import { Plus, Upload, Download, AlertCircle, FileSpreadsheet, FileDown } from 'lucide-react';
import { User, Page } from '../App';
import Layout from './Layout';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { toast } from 'sonner';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fetchCalibrations, syncCalibrations } from '../features/calibration/calibrationSlice';

interface CalibrationManagementProps {
  user: User;
  onNavigate: (page: Page) => void;
  onLogout: () => void;
}

// Fetched from backend via Redux.

export default function CalibrationManagement({ user, onNavigate, onLogout }: CalibrationManagementProps) {
  const [plantFilter, setPlantFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const dispatch = useAppDispatch();
  const { records: calibrations, loading, error } = useAppSelector(state => state.calibration);

  const [addRecordOpen, setAddRecordOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (calibrations.length === 0 && !loading) {
      dispatch(fetchCalibrations());
    }
  }, [calibrations.length, dispatch, loading]);

  // CSV utility functions
  const jsonToCsv = (data: any[]): string => {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.map(h => `"${h}"`).join(','),
      ...data.map(row => 
        headers.map(h => {
          const value = row[h];
          const stringValue = String(value || '');
          return `"${stringValue.replace(/"/g, '""')}"`;
        }).join(',')
      )
    ].join('\n');
    
    return csvContent;
  };

  const parseCsv = (csvText: string): Record<string, string>[] => {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];
    
    const headers = lines[0]
      .split(',')
      .map(h => h.replace(/^"|"$/g, '').trim())
      .filter(h => h);
    
    const rows = lines.slice(1).map(line => {
      const values: string[] = [];
      let currentValue = '';
      let insideQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (insideQuotes && line[i + 1] === '"') {
            currentValue += '"';
            i++;
          } else {
            insideQuotes = !insideQuotes;
          }
        } else if (char === ',' && !insideQuotes) {
          values.push(currentValue.trim().replace(/^"|"$/g, ''));
          currentValue = '';
        } else {
          currentValue += char;
        }
      }
      values.push(currentValue.trim().replace(/^"|"$/g, ''));
      
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      return row;
    });
    
    return rows;
  };

  const overdueCount = calibrations.filter(c => c.status === 'Overdue').length;
  const dueSoonCount = calibrations.filter(c => c.status === 'Due Soon').length;

  const filteredCalibrations = calibrations.filter(cal => {
    const matchesStatus = statusFilter === 'all' || cal.status === statusFilter;
    return matchesStatus;
  });

  const getStatusColor = (status: string, remainingDays: number) => {
    if (status === 'Overdue' || remainingDays < 0) {
      return '#ed1c24';
    } else if (status === 'Overdue' || remainingDays <= 7) {
      return '#f5a623';
    }
    return '#2ecc71';
  };

  const getRowClassName = (remainingDays: number) => {
    if (remainingDays < 0) {
      return 'bg-red-50 hover:bg-red-100 border-l-4 border-l-[#ed1c24]';
    } else if (remainingDays <= 7) {
      return 'bg-orange-50 hover:bg-orange-100 border-l-4 border-l-[#f5a623]';
    }
    return 'hover:bg-muted/30';
  };

  const handleExport = () => {
    const csvContent = jsonToCsv(calibrations);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'Calibration_Records.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Export completed');
  };

  const handleDownloadTemplate = () => {
    const headers = [
      'instrument', 'make', 'instrumentId', 'serialNo', 'range',
      'acceptanceCriteria', 'calibrationOn', 'dueDate',
      'certificateNo', 'calibratedBy', 'remarks'
    ];
    const csvContent = `"${headers.join('","')}"`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'Calibration_Template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Template downloaded');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const csvText = event.target?.result as string;
        const parsedData = parseCsv(csvText);

        if (parsedData && parsedData.length > 0) {
          const newRecords = parsedData.map((row: any, index: number) => ({
            id: row.id ? String(row.id) : String(Date.now() + index),
            instrument: String(row.instrument || ''),
            make: String(row.make || ''),
            instrumentId: String(row.instrumentId || ''),
            serialNo: String(row.serialNo || ''),
            range: String(row.range || ''),
            acceptanceCriteria: String(row.acceptanceCriteria || ''),
            calibrationOn: String(row.calibrationOn || ''),
            dueDate: String(row.dueDate || ''),
            certificateNo: String(row.certificateNo || ''),
            calibratedBy: String(row.calibratedBy || ''),
            remarks: String(row.remarks || '')
          }));

          dispatch(syncCalibrations(newRecords))
            .unwrap()
            .then(() => {
              toast.success(`Successfully imported/merged ${newRecords.length} records to backend`);
              dispatch(fetchCalibrations());
              setAddRecordOpen(false);
              if (fileInputRef.current) fileInputRef.current.value = '';
            })
            .catch((err) => {
              toast.error(err || 'Failed to sync calibrations with backend');
            });
        } else {
          toast.error('No data found in CSV file');
        }
      } catch (err) {
        toast.error('Failed to parse CSV file');
      }
    };
    reader.readAsText(file);
  };

  const handleUploadCertificate = () => {
    toast.info('Upload Certificate dialog would open here');
  };

  return (
    <Layout user={user} currentPage="calibration" onNavigate={onNavigate} onLogout={onLogout} title="Calibration Management">
      <div className="space-y-6">
        {/* Alert Banner */}
        {/* {(overdueCount > 0 || dueSoonCount > 0) && (
          <Alert style={{ borderColor: '#ed1c24', backgroundColor: '#fff5f5' }}>
            <AlertCircle className="h-4 w-4" style={{ color: '#ed1c24' }} />
            <AlertTitle>Calibration Alerts</AlertTitle>
            <AlertDescription>
              {overdueCount > 0 && <span className="block font-medium text-[#ed1c24]">{overdueCount} instrument(s) overdue for calibration. Usage restricted.</span>}
              {dueSoonCount > 0 && <span className="block mt-1 text-[#f5a623]">{dueSoonCount} instrument(s) due for calibration soon.</span>}
            </AlertDescription>
          </Alert>
        )} */}

        <Card style={{ borderRadius: '12px' }}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle></CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleDownloadTemplate} className="border-dashed border-primary text-primary">
                  <FileDown className="w-4 h-4 mr-2" />
                  Template
                </Button>
                <Button variant="outline" onClick={handleExport}>
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
                <Button style={{ backgroundColor: '#ed1c24' }} onClick={() => setAddRecordOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Record
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            {/* <div className="flex gap-4 mb-6">
              <Select value={plantFilter} onValueChange={setPlantFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Plant" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Plants</SelectItem>
                  <SelectItem value="plant1">Aurangabad Plant 1</SelectItem>
                  <SelectItem value="plant2">Aurangabad Plant 2</SelectItem>
                  <SelectItem value="pune">Pune Plant</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Due Soon">Due Soon</SelectItem>
                  <SelectItem value="Overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div> */}

            {/* Calibration Table */}
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>S.No</TableHead>
                    <TableHead>Instrument</TableHead>
                    <TableHead>Make</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>Serial No</TableHead>
                    <TableHead>Range</TableHead>
                    <TableHead>Acceptance</TableHead>
                    <TableHead>Calibrated On</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Remaining Days</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Certificate No</TableHead>
                    <TableHead>Calibrated By</TableHead>
                    <TableHead>Remarks</TableHead>
                    {/* <TableHead>Certificate</TableHead> */}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCalibrations.map((cal, index) => (
                    <TableRow key={cal.id} className={getRowClassName(cal.remainingDays)}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell className="font-medium">{cal.instrument}</TableCell>
                      <TableCell>{cal.make}</TableCell>
                      <TableCell>{cal.instrumentId}</TableCell>
                      <TableCell>{cal.serialNo}</TableCell>
                      <TableCell>{cal.range}</TableCell>
                      <TableCell>{cal.acceptanceCriteria}</TableCell>
                      <TableCell>{cal.calibrationOn}</TableCell>
                      <TableCell>{cal.dueDate}</TableCell>
                      <TableCell>
                        <span
                          style={{
                            color: getStatusColor(cal.status, cal.remainingDays),
                            fontWeight: 500
                          }}
                        >
                          {cal.remainingDays} days
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          style={{
                            backgroundColor: getStatusColor(cal.status, cal.remainingDays),
                            color: '#ffffff'
                          }}
                        >
                          {cal.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{cal.certificateNo}</TableCell>
                      <TableCell>{cal.calibratedBy}</TableCell>
                      <TableCell className="text-muted-foreground">{cal.remarks || '-'}</TableCell>
                      <TableCell>
                        {/* <Button variant="ghost" size="sm" onClick={handleUploadCertificate}>
                          <Upload className="w-4 h-4 text-blue-600" />
                        </Button> */}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Dialog open={addRecordOpen} onOpenChange={setAddRecordOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Calibration Records</DialogTitle>
              <DialogDescription>
                Upload a CSV file containing the calibration records. Ensure the headers match the required standard.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center justify-center py-10 border-2 border-dashed rounded-lg border-muted-foreground/25 bg-muted/10 hover:bg-muted/20 transition-colors">
              <FileSpreadsheet className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-sm font-medium mb-1">Drag and drop your CSV file here</p>
              <p className="text-sm text-muted-foreground mb-4">or click to browse from your computer</p>
              <label className="cursor-pointer">
                <Input
                  type="file"
                  ref={fileInputRef}
                  accept=".csv"
                  className="hidden"
                  style={{ display: 'none' }}
                  onChange={handleFileUpload}
                  onClick={(e) => (e.currentTarget.value = '')}
                />
                <Button variant="outline" asChild>
                  <span>Select File</span>
                </Button>
              </label>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
