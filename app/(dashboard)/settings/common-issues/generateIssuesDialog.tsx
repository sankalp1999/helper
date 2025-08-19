"use client";

import { Edit2, Trash } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface GeneratedIssue {
  title: string;
  description?: string;
  reasoning: string;
}

interface GenerateIssuesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  suggestions: GeneratedIssue[];
  onApprove: (approvedSuggestions: { title: string; description?: string }[]) => void;
  isCreating: boolean;
}

export function GenerateIssuesDialog({
  isOpen,
  onClose,
  suggestions,
  onApprove,
  isCreating,
}: GenerateIssuesDialogProps) {
  const [editableSuggestions, setEditableSuggestions] = useState<GeneratedIssue[]>(suggestions);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  useEffect(() => {
    if (suggestions.length !== editableSuggestions.length) {
      setEditableSuggestions(suggestions);
    }
  }, [suggestions.length]);

  const handleEdit = (index: number) => {
    setEditingIndex(index);
  };

  const handleSave = (index: number, title: string, description: string) => {
    setEditableSuggestions((prev) =>
      prev.map((suggestion, i) => (i === index ? { ...suggestion, title, description } : suggestion)),
    );
    setEditingIndex(null);
  };

  const handleDelete = (index: number) => {
    setEditableSuggestions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleApprove = () => {
    const approvedSuggestions = editableSuggestions.map(({ title, description }) => ({
      title,
      description,
    }));
    onApprove(approvedSuggestions);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review generated common issues</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Review and edit the AI-generated common issues before creating them. You can modify titles, descriptions, or
            remove issues you don't want.
          </p>
        </DialogHeader>

        <div className="space-y-4">
          {editableSuggestions.map((suggestion, index) => (
            <div key={index} className="border rounded-lg p-4 space-y-3">
              {editingIndex === index ? (
                <EditIssueForm
                  suggestion={suggestion}
                  onSave={(title, description) => handleSave(index, title, description)}
                  onCancel={() => setEditingIndex(null)}
                />
              ) : (
                <ViewIssue
                  suggestion={suggestion}
                  onEdit={() => handleEdit(index)}
                  onDelete={() => handleDelete(index)}
                />
              )}
            </div>
          ))}

          {editableSuggestions.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No issues to create. All suggestions have been removed.
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outlined" onClick={onClose} disabled={isCreating}>
            Cancel
          </Button>
          <Button onClick={handleApprove} disabled={editableSuggestions.length === 0 || isCreating}>
            {isCreating
              ? "Creating..."
              : `Create ${editableSuggestions.length} issue${editableSuggestions.length !== 1 ? "s" : ""}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface EditIssueFormProps {
  suggestion: GeneratedIssue;
  onSave: (title: string, description: string) => void;
  onCancel: () => void;
}

function EditIssueForm({ suggestion, onSave, onCancel }: EditIssueFormProps) {
  const [title, setTitle] = useState(suggestion.title);
  const [description, setDescription] = useState(suggestion.description || "");

  const handleSave = () => {
    if (title.trim()) {
      onSave(title.trim(), description.trim());
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium">Title</label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Issue title" />
      </div>
      <div>
        <label className="text-sm font-medium">Description</label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Issue description (optional)"
          rows={3}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outlined" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSave} disabled={!title.trim()}>
          Save
        </Button>
      </div>
    </div>
  );
}

interface ViewIssueProps {
  suggestion: GeneratedIssue;
  onEdit: () => void;
  onDelete: () => void;
}

function ViewIssue({ suggestion, onEdit, onDelete }: ViewIssueProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h4 className="font-medium">{suggestion.title}</h4>
          {suggestion.description && <p className="text-sm text-muted-foreground mt-1">{suggestion.description}</p>}
        </div>
        <div className="flex gap-1 ml-2">
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete}>
            <Trash className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
        <strong>AI reasoning:</strong> {suggestion.reasoning}
      </div>
    </div>
  );
}
