import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import dynamic from "next/dynamic";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

// Import components dynamically to avoid SSR issues
const UploadPart1 = dynamic(() => import("@/components/upload/UploadPart1"), {
  ssr: false,
});
const UploadPart2 = dynamic(() => import("@/components/upload/UploadPart2"), {
  ssr: false,
});
const MusicSelector = dynamic(() => import("@/components/music/MusicSelector"), {
  ssr: false,
});
const HooksEditor = dynamic(() => import("@/components/HookEditor"), {
  ssr: false,
});
const VideoGenerator = dynamic(
  () => import("@/components/generator/VideoGenerator"),
  { ssr: false }
);

export default function ProjectEditor() {
  return (
    <Card className="border rounded-xl">
      <div className="border-b p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Project Editor</h2>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Progress</span>
              <Progress value={33} className="w-[100px]" />
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="template" className="w-full">
        <TabsList className="w-full justify-start border-b rounded-none p-0">
          <TabsTrigger
            value="template"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
          >
            Template
          </TabsTrigger>
          <TabsTrigger
            value="media"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
          >
            Media
          </TabsTrigger>
          <TabsTrigger
            value="music"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
          >
            Music
          </TabsTrigger>
          <TabsTrigger
            value="hooks"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
          >
            Hooks
          </TabsTrigger>
          <TabsTrigger
            value="generate"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
          >
            Generate
          </TabsTrigger>
        </TabsList>

        <div className="p-4">
          <TabsContent value="template">
            <UploadPart1 />
          </TabsContent>
          <TabsContent value="media">
            <UploadPart2 />
          </TabsContent>
          <TabsContent value="music">
            <MusicSelector />
          </TabsContent>
          <TabsContent value="hooks">
            <HooksEditor />
          </TabsContent>
          <TabsContent value="generate">
            <VideoGenerator />
          </TabsContent>
        </div>
      </Tabs>
    </Card>
  );
} 