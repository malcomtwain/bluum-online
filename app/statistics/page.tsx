"use client";

import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";

type Platform = "TIKTOK" | "INSTAGRAM" | "YOUTUBE";

interface AccountMetrics {
  accountId: string;
  platform: Platform;
  username: string;
  posts: number;
  views: number;
  followers: number;
  likes: number;
  comments: number;
  reposts: number;
}

export default function StatisticsPage() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<AccountMetrics[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setIsLoading(true);
      try {
        // Placeholder: derive usernames from social-usernames; real metrics would come from platform APIs or stored analytics
        const resp = await fetch('/api/social-usernames', { headers: { 'x-invitation-code': user.id } });
        const data = await resp.json();
        const rows: any[] = data?.rows || [];
        const seeded: AccountMetrics[] = rows
          .filter(r => ["TIKTOK","INSTAGRAM","YOUTUBE"].includes(r.platform))
          .map((r: any) => ({
            accountId: r.account_id,
            platform: r.platform,
            username: r.custom_username,
            // seed with zeros until real metrics exist
            posts: 0,
            views: 0,
            followers: 0,
            likes: 0,
            comments: 0,
            reposts: 0,
          }));
        setMetrics(seeded);

        // Enrich TikTok accounts with live profile data
        const tiktokAccounts = seeded.filter(m => m.platform === 'TIKTOK' && m.username);
        if (tiktokAccounts.length > 0) {
          const enriched = await Promise.all(
            tiktokAccounts.map(async (m) => {
              try {
                const r = await fetch(`/api/tiktok-profile?username=${encodeURIComponent(m.username)}`);
                if (!r.ok) return m;
                const p = await r.json();
                return {
                  ...m,
                  followers: Number(p.followers || 0),
                  posts: Number(p.videos || 0),
                  likes: Number(p.hearts || 0),
                } as AccountMetrics;
              } catch {
                return m;
              }
            })
          );

          // Merge back into metrics
          setMetrics(prev => {
            const map = new Map(prev.map(x => [x.accountId, x] as const));
            for (const e of enriched) {
              map.set(e.accountId, e);
            }
            return Array.from(map.values());
          });
        }
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [user]);

  const aggregateByPlatform = useMemo(() => {
    const agg: Record<Platform, Omit<AccountMetrics, 'accountId' | 'username' | 'platform'>> = {
      TIKTOK: { posts: 0, views: 0, followers: 0, likes: 0, comments: 0, reposts: 0 },
      INSTAGRAM: { posts: 0, views: 0, followers: 0, likes: 0, comments: 0, reposts: 0 },
      YOUTUBE: { posts: 0, views: 0, followers: 0, likes: 0, comments: 0, reposts: 0 },
    } as any;
    for (const m of metrics) {
      const a = agg[m.platform as Platform];
      if (!a) continue;
      a.posts += m.posts;
      a.views += m.views;
      a.followers += m.followers;
      a.likes += m.likes;
      a.comments += m.comments;
      a.reposts += m.reposts;
    }
    return agg;
  }, [metrics]);

  const platformIcon = (p: Platform) => {
    switch (p) {
      case 'TIKTOK':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 293768 333327" className="w-5 h-5"><path d="M204958 0c5369 45832 32829 78170 77253 81022v43471l-287 27V87593c-44424-2850-69965-30183-75333-76015l-47060-1v192819c6791 86790-60835 89368-86703 56462 30342 18977 79608 6642 73766-68039V0h58365zM78515 319644c-26591-5471-50770-21358-64969-44588-34496-56437-3401-148418 96651-157884v54345l-164 27v-40773C17274 145544 7961 245185 33650 286633c9906 15984 26169 27227 44864 33011z" fill="#26f4ee"/><path d="M218434 11587c3505 29920 15609 55386 35948 70259-27522-10602-43651-34934-47791-70262l11843 3zm63489 82463c3786 804 7734 1348 11844 1611v51530c-25770 2537-48321-5946-74600-21749l4034 88251c0 28460 106 41467-15166 67648-34260 58734-95927 63376-137628 35401 54529 22502 137077-4810 136916-103049v-96320c26279 15803 48830 24286 74600 21748V94050zm-171890 37247c5390-1122 11048-1985 16998-2548v54345c-21666 3569-35427 10222-41862 22528-20267 38754 5827 69491 35017 74111-33931 5638-73721-28750-49999-74111 6434-12304 18180-18959 39846-22528v-51797zm64479-119719h1808-1808z" fill="#fb2c53"/><path d="M206590 11578c5369 45832 30910 73164 75333 76015v51528c-25770 2539-48321-5945-74600-21748v96320c206 125717-135035 135283-173673 72939-25688-41449-16376-141089 76383-155862v52323c-21666 3569-33412 10224-39846 22528-39762 76035 98926 121273 89342-1225V11577l47060 1z"/></svg>
        );
      case 'INSTAGRAM':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 132.004 132" className="w-5 h-5"><defs><linearGradient id="b"><stop offset="0" stopColor="#3771c8"/><stop stopColor="#3771c8" offset=".128"/><stop offset="1" stopColor="#60f" stopOpacity="0"/></linearGradient><linearGradient id="a"><stop offset="0" stopColor="#fd5"/><stop offset=".1" stopColor="#fd5"/><stop offset=".5" stopColor="#ff543e"/><stop offset="1" stopColor="#c837ab"/></linearGradient><radialGradient id="c" cx="158.429" cy="578.088" r="65" xlinkHref="#a" gradientUnits="userSpaceOnUse" gradientTransform="matrix(0 -1.98198 1.8439 0 -1031.402 454.004)" fx="158.429" fy="578.088"/><radialGradient id="d" cx="147.694" cy="473.455" r="65" xlinkHref="#b" gradientUnits="userSpaceOnUse" gradientTransform="matrix(.17394 .86872 -3.5818 .71718 1648.348 -458.493)" fx="147.694" fy="473.455"/></defs><path fill="url(#c)" d="M65.03 0C37.888 0 29.95.028 28.407.156c-5.57.463-9.036 1.34-12.812 3.22-2.91 1.445-5.205 3.12-7.47 5.468C4 13.126 1.5 18.394.595 24.656c-.44 3.04-.568 3.66-.594 19.188-.01 5.176 0 11.988 0 21.125 0 27.12.03 35.05.16 36.59.45 5.42 1.3 8.83 3.1 12.56 3.44 7.14 10.01 12.5 17.75 14.5 2.68.69 5.64 1.07 9.44 1.25 1.61.07 18.02.12 34.44.12 16.42 0 32.84-.02 34.41-.1 4.4-.207 6.955-.55 9.78-1.28 7.79-2.01 14.24-7.29 17.75-14.53 1.765-3.64 2.66-7.18 3.065-12.317.088-1.12.125-18.977.125-36.81 0-17.836-.04-35.66-.128-36.78-.41-5.22-1.305-8.73-3.127-12.44-1.495-3.037-3.155-5.305-5.565-7.624C116.9 4 111.64 1.5 105.372.596 102.335.157 101.73.027 86.19 0H65.03z" transform="translate(1.004 1)"/><path fill="url(#d)" d="M65.03 0C37.888 0 29.95.028 28.407.156c-5.57.463-9.036 1.34-12.812 3.22-2.91 1.445-5.205 3.12-7.47 5.468C4 13.126 1.5 18.394.595 24.656c-.44 3.04-.568 3.66-.594 19.188-.01 5.176 0 11.988 0 21.125 0 27.12.03 35.05.16 36.59.45 5.42 1.3 8.83 3.1 12.56 3.44 7.14 10.01 12.5 17.75 14.5 2.68.69 5.64 1.07 9.44 1.25 1.61.07 18.02.12 34.44.12 16.42 0 32.84-.02 34.41-.1 4.4-.207 6.955-.55 9.78-1.28 7.79-2.01 14.24-7.29 17.75-14.53 1.765-3.64 2.66-7.18 3.065-12.317.088-1.12.125-18.977.125-36.81 0-17.836-.04-35.66-.128-36.78-.41-5.22-1.305-8.73-3.127-12.44-1.495-3.037-3.155-5.305-5.565-7.624C116.9 4 111.64 1.5 105.372.596 102.335.157 101.73.027 86.19 0H65.03z" transform="translate(1.004 1)"/><path fill="#fff" d="M66.004 18c-13.036 0-14.672.057-19.792.29-5.11.234-8.598 1.043-11.65 2.23-3.157 1.226-5.835 2.866-8.503 5.535-2.67 2.668-4.31 5.346-5.54 8.502-1.19 3.053-2 6.542-2.23 11.65C18.06 51.327 18 52.964 18 66s.058 14.667.29 19.787c.235 5.11 1.044 8.598 2.23 11.65 1.227 3.157 2.867 5.835 5.536 8.503 2.667 2.67 5.345 4.314 8.5 5.54 3.054 1.187 6.543 1.996 11.652 2.23 5.12.233 6.755.29 19.79.29 13.037 0 14.668-.057 19.788-.29 5.11-.234 8.602-1.043 11.656-2.23 3.156-1.226 5.83-2.87 8.497-5.54 2.67-2.668 4.31-5.346 5.54-8.502 1.18-3.053 1.99-6.542 2.23-11.65.23-5.12.29-6.752.29-19.788 0-13.036-.06-14.672-.29-19.792-.24-5.11-1.05-8.598-2.23-11.65-1.23-3.157-2.87-5.835-5.54-8.503-2.67-2.67-5.34-4.31-8.5-5.535-3.06-1.187-6.55-1.996-11.66-2.23-5.12-.233-6.75-.29-19.79-.29zm-4.306 8.65c1.278-.002 2.704 0 4.306 0 12.816 0 14.335.046 19.396.276 4.68.214 7.22.996 8.912 1.653 2.24.87 3.837 1.91 5.516 3.59 1.68 1.68 2.72 3.28 3.592 5.52.657 1.69 1.44 4.23 1.653 8.91.23 5.06.28 6.58.28 19.39s-.05 14.33-.28 19.39c-.214 4.68-.996 7.22-1.653 8.91-.87 2.24-1.912 3.835-3.592 5.514-1.68 1.68-3.275 2.72-5.516 3.59-1.69.66-4.232 1.44-8.912 1.654-5.06.23-6.58.28-19.396.28-12.817 0-14.336-.05-19.396-.28-4.68-.216-7.22-.998-8.913-1.655-2.24-.87-3.84-1.91-5.52-3.59-1.68-1.68-2.72-3.276-3.592-5.517-.657-1.69-1.44-4.23-1.653-8.91-.23-5.06-.276-6.58-.276-19.398s.046-14.33.276-19.39c.214-4.68.996-7.22 1.653-8.912.87-2.24 1.912-3.84 3.592-5.52 1.68-1.68 3.28-2.72 5.52-3.592 1.692-.66 4.233-1.44 8.913-1.655 4.428-.2 6.144-.26 15.09-.27zm29.928 7.97c-3.18 0-5.76 2.577-5.76 5.758 0 3.18 2.58 5.76 5.76 5.76 3.18 0 5.76-2.58 5.76-5.76 0-3.18-2.58-5.76-5.76-5.76zm-25.622 6.73c-13.613 0-24.65 11.037-24.65 24.65 0 13.613 11.037 24.645 24.65 24.645C79.617 90.645 90.65 79.613 90.65 66S79.616 41.35 66.003 41.35zm0 8.65c8.836 0 16 7.163 16 16 0 8.836-7.164 16-16 16-8.837 0-16-7.164-16-16 0-8.837 7.163-16 16-16z"/></svg>
        );
      case 'YOUTUBE':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 333333 333333" className="w-5 h-5"><path d="M329930 100020s-3254-22976-13269-33065c-12691-13269-26901-13354-33397-14124-46609-3396-116614-3396-116614-3396h-122s-69973 0-116608 3396c-6522 793-20712 848-33397 14124C6501 77044 3316 100020 3316 100020S-1 126982-1 154001v25265c0 26962 3315 53979 3315 53979s3254 22976 13207 33082c12685 13269 29356 12838 36798 14254 26685 2547 113354 3315 113354 3315s70065-124 116675-3457c6522-770 20706-848 33397-14124 10021-10089 13269-33090 13269-33090s3319-26962 3319-53979v-25263c-67-26962-3384-53979-3384-53979l-18 18-2-2zM132123 209917v-93681l90046 46997-90046 46684z" fill="red"/></svg>
        );
    }
  };

  const platformLabel = (p: Platform) => {
    switch (p) {
      case 'TIKTOK':
        return 'TikTok';
      case 'INSTAGRAM':
        return 'Instagram';
      case 'YOUTUBE':
        return 'YouTube';
    }
  };

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: '#f3f4f0' }}>
      <div className="p-6 xl:p-8">
        <div className="pt-8 xl:pt-8 max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Statistics</h1>
          </div>

          <Tabs defaultValue="social" className="w-full">
            <TabsList className="w-full justify-start border-b rounded-none p-0 bg-transparent">
              <TabsTrigger value="social" className="rounded-none border-b-2 border-transparent data-[state=active]:border-black">
                Social Accounts
              </TabsTrigger>
            </TabsList>

            <TabsContent value="social" className="mt-6">
              <div className="space-y-8">
                {/* Aggregate per-platform table */}
                <div className="bg-white rounded-xl border p-4 overflow-x-auto">
                  <h3 className="text-lg font-semibold mb-3">Totals by Platform</h3>
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-600">
                        <th className="py-2 pr-4">Platform</th>
                        <th className="py-2 pr-4">Views Total</th>
                        <th className="py-2 pr-4">Followers Total</th>
                        <th className="py-2 pr-4">Posts Total</th>
                        <th className="py-2 pr-4">Likes Total</th>
                        <th className="py-2 pr-4">Comments Total</th>
                        <th className="py-2 pr-4">Reposts Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(Object.keys(aggregateByPlatform) as Platform[]).map((p) => (
                        <tr key={p} className="border-t">
                          <td className="py-2 pr-4 font-medium">
                            <span className="inline-flex items-center gap-2">
                              <span className="text-gray-700">{platformIcon(p)}</span>
                              {platformLabel(p)}
                            </span>
                          </td>
                          <td className="py-2 pr-4">{aggregateByPlatform[p as Platform].views}</td>
                          <td className="py-2 pr-4">{aggregateByPlatform[p as Platform].followers}</td>
                          <td className="py-2 pr-4">{aggregateByPlatform[p as Platform].posts}</td>
                          <td className="py-2 pr-4">{aggregateByPlatform[p as Platform].likes}</td>
                          <td className="py-2 pr-4">{aggregateByPlatform[p as Platform].comments}</td>
                          <td className="py-2 pr-4">{aggregateByPlatform[p as Platform].reposts}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Per-account table */}
                <div className="bg-white rounded-xl border p-4 overflow-x-auto">
                  <h3 className="text-lg font-semibold mb-3">Accounts</h3>
                  {isLoading ? (
                    <div className="text-gray-500">Loading...</div>
                  ) : (
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-600">
                          <th className="py-2 pr-4">Platform</th>
                          <th className="py-2 pr-4">Username</th>
                          <th className="py-2 pr-4">Views</th>
                          <th className="py-2 pr-4">Followers</th>
                          <th className="py-2 pr-4">Posts</th>
                          <th className="py-2 pr-4">Likes</th>
                          <th className="py-2 pr-4">Comments</th>
                          <th className="py-2 pr-4">Reposts</th>
                          <th className="py-2 pr-4">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {metrics.map((m) => (
                          <tr key={m.accountId} className="border-t">
                            <td className="py-2 pr-4">
                              <span className="inline-flex items-center gap-2">
                                {platformIcon(m.platform as Platform)}
                                {platformLabel(m.platform as Platform)}
                              </span>
                            </td>
                            <td className="py-2 pr-4">@{m.username}</td>
                            <td className="py-2 pr-4">{m.views}</td>
                            <td className="py-2 pr-4">{m.followers}</td>
                            <td className="py-2 pr-4">{m.posts}</td>
                            <td className="py-2 pr-4">{m.likes}</td>
                            <td className="py-2 pr-4">{m.comments}</td>
                            <td className="py-2 pr-4">{m.reposts}</td>
                            <td className="py-2 pr-4">
                              <a href={`/posts?account=${encodeURIComponent(m.accountId)}`} className="text-blue-600 hover:underline">View posts</a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}


