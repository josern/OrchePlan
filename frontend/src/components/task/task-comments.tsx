import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Edit2, Trash2, Send, X } from 'lucide-react';
import { getTaskComments, createTaskComment, updateTaskComment, deleteTaskComment } from '@/lib/api';
import { TaskComment } from '@/lib/types';
import { useApp } from '@/context/app-context';
import { toast } from '@/hooks/use-toast';

interface TaskCommentsProps {
  taskId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function TaskComments({ taskId, isOpen, onClose }: TaskCommentsProps) {
  const { currentUser } = useApp();
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && taskId) {
      loadComments();
    }
  }, [isOpen, taskId]);

  const loadComments = async () => {
    try {
      setLoading(true);
      const response = await getTaskComments(taskId);
      setComments(response.comments || []);
    } catch (error) {
      console.error('Error loading comments:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load comments',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim()) return;

    try {
      setSubmitting(true);
      const response = await createTaskComment(taskId, newComment.trim());
      setComments(prev => [...prev, response.comment]);
      setNewComment('');
      toast({
        title: 'Success',
        description: 'Comment added successfully',
      });
    } catch (error) {
      console.error('Error creating comment:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to add comment',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditComment = (comment: TaskComment) => {
    setEditingCommentId(comment.id);
    setEditingContent(comment.content);
  };

  const handleSaveEdit = async () => {
    if (!editingCommentId || !editingContent.trim()) return;

    try {
      const response = await updateTaskComment(taskId, editingCommentId, editingContent.trim());
      setComments(prev => prev.map(c => c.id === editingCommentId ? response.comment : c));
      setEditingCommentId(null);
      setEditingContent('');
      toast({
        title: 'Success',
        description: 'Comment updated successfully',
      });
    } catch (error) {
      console.error('Error updating comment:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update comment',
      });
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;

    try {
      await deleteTaskComment(taskId, commentId);
      setComments(prev => prev.filter(c => c.id !== commentId));
      toast({
        title: 'Success',
        description: 'Comment deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to delete comment',
      });
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff / (1000 * 60));

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-2xl max-h-[80vh] flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Task Comments
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        
        <CardContent className="flex-1 overflow-hidden flex flex-col">
          {/* Comments List */}
          <div className="flex-1 overflow-y-auto space-y-4 mb-4">
            {loading ? (
              <div className="text-center text-muted-foreground">Loading comments...</div>
            ) : comments.length === 0 ? (
              <div className="text-center text-muted-foreground">No comments yet</div>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{comment.author.name}</span>
                      <span className="text-sm text-muted-foreground">
                        {formatDate(comment.createdAt)}
                      </span>
                      {comment.status && (
                                                <Badge 
                          variant="outline" 
                          style={{ backgroundColor: `${comment.status.color}20`, borderColor: comment.status.color }}
                        >
                          {comment.status.name}
                        </Badge>
                      )}
                    </div>
                    {currentUser?.id === comment.author.id && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditComment(comment)}
                          disabled={editingCommentId !== null}
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteComment(comment.id)}
                          disabled={editingCommentId !== null}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  {editingCommentId === comment.id ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editingContent}
                        onChange={(e) => setEditingContent(e.target.value)}
                        placeholder="Edit your comment..."
                        rows={3}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleSaveEdit}>
                          Save
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => {
                            setEditingCommentId(null);
                            setEditingContent('');
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
                  )}
                </div>
              ))
            )}
          </div>

          {/* New Comment Form */}
          <div className="border-t pt-4 space-y-3">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              rows={3}
              disabled={submitting || editingCommentId !== null}
            />
            <div className="flex justify-end">
              <Button
                onClick={handleSubmitComment}
                disabled={!newComment.trim() || submitting || editingCommentId !== null}
                size="sm"
              >
                <Send className="h-4 w-4 mr-2" />
                {submitting ? 'Adding...' : 'Add Comment'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}