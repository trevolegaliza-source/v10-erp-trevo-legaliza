import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface ContractPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string | null;
  fileName: string;
}

export default function ContractPreviewModal({ open, onOpenChange, url, fileName }: ContractPreviewModalProps) {
  if (!url) return null;

  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const isImage = ['png', 'jpg', 'jpeg', 'webp'].includes(ext);
  const isPdf = ext === 'pdf';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="truncate text-sm">{fileName}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-auto rounded-md border border-border bg-muted/20">
          {isPdf ? (
            <iframe src={url} className="w-full h-[70vh] rounded-md" title={fileName} />
          ) : isImage ? (
            <img src={url} alt={fileName} className="w-full h-auto max-h-[70vh] object-contain mx-auto" />
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
              <p className="text-sm">Pré-visualização não disponível para este formato.</p>
              <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary underline text-sm">
                Abrir em nova aba
              </a>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
