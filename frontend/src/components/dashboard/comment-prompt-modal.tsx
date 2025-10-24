'use client';

import React, { useState, memo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useModal } from '@/context/modal-context';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface CommentPromptModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onConfirm: (comment: string) => void;
  statusName?: string;
  taskTitle?: string;
  isRequired: boolean;
  // injected by ModalProvider when opened through the registry
  modalId?: number;
}

const CommentPromptModal = memo<CommentPromptModalProps>(function CommentPromptModal({
  isOpen,
  onClose,
  onConfirm,
  statusName = 'the selected status',
  taskTitle = 'this task',
  isRequired,
  modalId
}: CommentPromptModalProps) {
  const [comment, setComment] = useState('');
  // modal registry (optional)
  let modal = null;
  try { modal = useModal(); } catch (e) { modal = null; }

  const handleConfirm = () => {
    if (isRequired && comment.trim() === '') {
      return; // Don't allow empty comment if required
    }
    onConfirm(comment.trim());
    setComment('');
    if (modalId && modal) {
      modal.closeModal(modalId);
    }
  };

  const handleClose = () => {
    setComment('');
    if (modalId && modal) {
      modal.closeModal(modalId);
      return;
    }
    if (onClose) onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isRequired ? 'Comment Required' : 'Add Comment (Optional)'}
          </DialogTitle>
          <DialogDescription>
            {isRequired ? (
              <>
                Moving "<strong>{taskTitle}</strong>" to "<strong>{statusName}</strong>" requires a comment.
              </>
            ) : (
              <>
                Add an optional comment when moving "<strong>{taskTitle}</strong>" to "<strong>{statusName}</strong>".
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-2">
          <Label htmlFor="comment">
            Comment {isRequired && <span className="text-red-500">*</span>}
          </Label>
          <Textarea
            id="comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={isRequired ? "Enter a comment for this status change..." : "Optional comment..."}
            className="min-h-[100px]"
            autoFocus
          />
          {isRequired && comment.trim() === '' && (
            <p className="text-sm text-red-500">A comment is required for this status.</p>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={isRequired && comment.trim() === ''}
          >
            {isRequired ? 'Move with Comment' : 'Move Task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

export default CommentPromptModal;
