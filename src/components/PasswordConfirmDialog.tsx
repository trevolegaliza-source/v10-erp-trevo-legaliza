import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

// Encoded deletion password — not stored in plain text
const _k = atob('UG9ycmFkYTEwQGJ5cDRibXN4eDM=');

interface PasswordConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
}

export default function PasswordConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title = 'Confirmar Exclusão',
  description = 'Digite a senha de administração para confirmar esta ação.',
}: PasswordConfirmDialogProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleConfirm = () => {
    if (password === _k) {
      setPassword('');
      setError(false);
      onOpenChange(false);
      onConfirm();
    } else {
      setError(true);
      toast.error('Senha incorreta');
    }
  };

  const handleClose = (o: boolean) => {
    if (!o) {
      setPassword('');
      setError(false);
    }
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label className="text-xs">Senha de Administração</Label>
            <Input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(false); }}
              onKeyDown={e => e.key === 'Enter' && handleConfirm()}
              placeholder="Digite a senha..."
              className={error ? 'border-destructive' : ''}
              autoFocus
            />
            {error && <p className="text-xs text-destructive">Senha incorreta. Tente novamente.</p>}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => handleClose(false)}>Cancelar</Button>
            <Button variant="destructive" size="sm" onClick={handleConfirm} disabled={!password}>Confirmar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
