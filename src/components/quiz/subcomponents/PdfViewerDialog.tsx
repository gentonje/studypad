"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface PdfViewerDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  pdfDataUri: string | null;
  pdfFileName?: string;
}

export function PdfViewerDialog({
  isOpen,
  onOpenChange,
  pdfDataUri,
  pdfFileName,
}: PdfViewerDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-[1200px] h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-2 border-b">
          <DialogTitle>PDF Document: {pdfFileName || "Uploaded PDF"}</DialogTitle>
        </DialogHeader>
        {pdfDataUri ? (
          <iframe
            src={pdfDataUri}
            className="flex-grow w-full h-full border-0"
            title={pdfFileName || "Uploaded PDF"}
          />
        ) : (
          <div className="flex-grow flex items-center justify-center text-muted-foreground p-1">
            <p>PDF will be displayed here once processed.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
} 