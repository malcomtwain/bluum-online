"use client";

import React, { useState } from 'react';
import { X, FolderPlus, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface BulkCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (titles: string[]) => Promise<void>;
  title: string;
  itemType: string; // 'collection', 'subcollection', etc.
  parentName?: string; // For subcollections
}

export default function BulkCreateModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  itemType,
  parentName
}: BulkCreateModalProps) {
  const [inputText, setInputText] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  
  if (!isOpen) return null;
  
  const handleCreate = async () => {
    const lines = inputText
      .split('\n')
      .map(line => {
        // Nettoyer le texte : enlever @ au début, trim, etc.
        let cleaned = line.trim();
        // Si ça commence par @, on l'enlève
        if (cleaned.startsWith('@')) {
          cleaned = cleaned.substring(1);
        }
        return cleaned;
      })
      .filter(line => line.length > 0);
    
    if (lines.length === 0) {
      toast.error('Please enter at least one name');
      return;
    }
    
    // Check for duplicates
    const uniqueLines = [...new Set(lines)];
    if (uniqueLines.length !== lines.length) {
      toast.error('Duplicate names detected. Please remove duplicates.');
      return;
    }
    
    setIsCreating(true);
    try {
      await onConfirm(uniqueLines);
      setInputText('');
      onClose();
    } catch (error) {
      console.error('Error creating items:', error);
      toast.error('Failed to create some items');
    } finally {
      setIsCreating(false);
    }
  };
  
  const previewItems = inputText
    .split('\n')
    .map(line => {
      // Même nettoyage que pour handleCreate
      let cleaned = line.trim();
      if (cleaned.startsWith('@')) {
        cleaned = cleaned.substring(1);
      }
      return cleaned;
    })
    .filter(line => line.length > 0);
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>
        
        {parentName && (
          <p className="text-sm text-gray-600 mb-4">
            Creating in: <span className="font-medium">{parentName}</span>
          </p>
        )}
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Enter {itemType} names (one per line)
          </label>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="w-full h-48 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            placeholder={`My First ${itemType}\nMy Second ${itemType}\nMy Third ${itemType}`}
            autoFocus
          />
        </div>
        
        {/* Preview section */}
        {previewItems.length > 0 && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <FolderPlus size={16} className="text-gray-600" />
              <span className="text-sm font-medium text-gray-700">
                Will create {previewItems.length} {itemType}{previewItems.length > 1 ? 's' : ''}:
              </span>
            </div>
            <div className="max-h-32 overflow-y-auto">
              <ul className="text-sm text-gray-600 space-y-1">
                {previewItems.slice(0, 10).map((item, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <span className="text-gray-400">•</span>
                    <span className="truncate">{item}</span>
                  </li>
                ))}
                {previewItems.length > 10 && (
                  <li className="text-gray-400 italic">
                    ... and {previewItems.length - 10} more
                  </li>
                )}
              </ul>
            </div>
          </div>
        )}
        
        {/* Info message */}
        <div className="flex items-start gap-2 mb-6 p-3 bg-blue-50 rounded-lg">
          <AlertCircle size={16} className="text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Tips:</p>
            <ul className="space-y-0.5 text-xs">
              <li>• Each line will create a separate {itemType}</li>
              <li>• Empty lines will be ignored</li>
              <li>• @ symbols at the start will be removed automatically</li>
              <li>• Duplicate names are not allowed</li>
              <li>• You can paste a list from another app</li>
            </ul>
          </div>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={handleCreate}
            disabled={isCreating || previewItems.length === 0}
            className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {isCreating 
              ? `Creating ${previewItems.length} ${itemType}${previewItems.length > 1 ? 's' : ''}...` 
              : `Create ${previewItems.length || 0} ${itemType}${previewItems.length !== 1 ? 's' : ''}`}
          </button>
          <button
            onClick={onClose}
            disabled={isCreating}
            className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}