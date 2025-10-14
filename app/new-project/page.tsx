"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ImageIcon, MusicIcon, TextIcon, WandIcon } from "lucide-react";

export default function NewProjectPage() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Create New Project</h1>
      
      <div className="rounded-xl border bg-white shadow-sm">
        <Tabs defaultValue="template">
          <TabsList>
            <TabsTrigger value="template">
              <ImageIcon className="mr-2 h-4 w-4" />
              Template
            </TabsTrigger>
            <TabsTrigger value="media">
              <ImageIcon className="mr-2 h-4 w-4" />
              Media
            </TabsTrigger>
            <TabsTrigger value="music">
              <MusicIcon className="mr-2 h-4 w-4" />
              Music
            </TabsTrigger>
            <TabsTrigger value="hooks">
              <TextIcon className="mr-2 h-4 w-4" />
              Hooks
            </TabsTrigger>
            <TabsTrigger value="generate">
              <WandIcon className="mr-2 h-4 w-4" />
              Generate
            </TabsTrigger>
          </TabsList>

          <TabsContent value="template">
            <div className="text-center p-6">
              <h3 className="text-lg font-semibold mb-2">Select a Template</h3>
              <p className="text-muted-foreground mb-4">
                Choose a template for your video or upload your own
              </p>
              <Button>Browse Templates</Button>
            </div>
          </TabsContent>

          <TabsContent value="media">
            <div className="text-center p-6">
              <h3 className="text-lg font-semibold mb-2">Add Media</h3>
              <p className="text-muted-foreground mb-4">
                Upload images or videos to include in your project
              </p>
              <Button>Upload Media</Button>
            </div>
          </TabsContent>

          <TabsContent value="music">
            <div className="text-center p-6">
              <h3 className="text-lg font-semibold mb-2">Choose Music</h3>
              <p className="text-muted-foreground mb-4">
                Select background music for your video
              </p>
              <Button>Browse Music</Button>
            </div>
          </TabsContent>

          <TabsContent value="hooks">
            <div className="text-center p-6">
              <h3 className="text-lg font-semibold mb-2">Add Hooks</h3>
              <p className="text-muted-foreground mb-4">
                Create and position text hooks for your video
              </p>
              <Button>Create Hooks</Button>
            </div>
          </TabsContent>

          <TabsContent value="generate">
            <div className="text-center p-6">
              <h3 className="text-lg font-semibold mb-2">Generate Video</h3>
              <p className="text-muted-foreground mb-4">
                Generate your video with the selected content
              </p>
              <Button>Start Generation</Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
} 