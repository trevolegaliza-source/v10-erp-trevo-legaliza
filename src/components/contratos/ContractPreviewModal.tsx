import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface ContractPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string | null;
  fileName: string;
  clienteName?: string;
}

export default function ContractPreviewModal({ open, onOpenChange, url, fileName, clienteName }: ContractPreviewModalProps) {
  if (!url) return null;

  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const isImage = ['png', 'jpg', 'jpeg', 'webp'].includes(ext);
  const isPdf = ext === 'pdf';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[85vw] max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="flex-row items-center justify-between px-6 py-4 border-b border-border/60">
          <div className="flex-1 min-w-0">
            <DialogTitle className="text-base font-semibold truncate">
              {clienteName ? `${clienteName} — ` : ''}{fileName}
            </DialogTitle>
          </div>
          <Button
            variant="ghost"
            size="lg"
            className="h-10 w-10 rounded-full hover:bg-destructive/10 hover:text-destructive shrink-0 ml-4"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-auto bg-muted/20 p-2">
          {isPdf ? (
            <iframe src={url} className="w-full h-[80vh] rounded-md border-0" title={fileName} />
          ) : isImage ? (
            <img src={url} alt={fileName} className="w-full h-auto max-h-[80vh] object-contain mx-auto rounded-md" />
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
