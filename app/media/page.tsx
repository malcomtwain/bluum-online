"use client";

import { Button } from "@/components/ui/button";
import { ImageIcon, UploadIcon } from "lucide-react";

export default function MediaLibraryPage() {
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Media Library</h1>
        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
          <UploadIcon className="mr-2 h-4 w-4" />
          Upload Media
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Media grid will be added here */}
        <div className="rounded-xl border bg-white p-6 hover:shadow-md transition-shadow flex flex-col items-center justify-center min-h-[200px] text-center">
          <ImageIcon className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No media files yet</h3>
          <p className="text-muted-foreground mb-4">
            Upload your first media file to get started
          </p>
        </div>
      </div>
    </div>
  );
} 