import { useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

interface ExtratoPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pdfBlobUrl: string | null;
  filename: string;
}

export function ExtratoPreviewDialog({
  open,
  onOpenChange,
  pdfBlobUrl,
  filename,
}: ExtratoPreviewDialogProps) {
  useEffect(() => {
    return () => {
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
    };
  }, [pdfBlobUrl]);

  const handleDownload = () => {
    if (!pdfBlobUrl) return;
    const a = document.createElement('a');
    a.href = pdfBlobUrl;
    a.download = filename || 'extrato.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b flex flex-row items-center justify-between">
          <DialogTitle className="text-sm font-medium truncate">{filename || 'Preview do Extrato'}</DialogTitle>
          <Button size="sm" variant="outline" onClick={handleDownload} disabled={!pdfBlobUrl}>
            <Download className="h-4 w-4 mr-1" />
            Baixar PDF
          </Button>
        </DialogHeader>
        <div className="flex-1 min-h-0">
          {pdfBlobUrl ? (
            <iframe src={pdfBlobUrl} className="w-full h-full border-0" title="Preview do Extrato" />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">Carregando extrato...</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
