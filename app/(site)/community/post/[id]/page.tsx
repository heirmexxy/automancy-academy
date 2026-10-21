import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import "../../community.css";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PostCard } from "../../_components/PostCard";
import { loadPost } from "../../_lib/data";

export const metadata: Metadata = { title: "Community post" };
export const dynamic = "force-dynamic";

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/community/post/${id}`);
  const post = await loadPost(await createClient(), user.id, id);
  if (!post) notFound();
  return (
    <div className="narrow community stack" style={{ paddingBlock: 24 }}>
      <p className="note"><Link href="/community">← Back to the community</Link></p>
      <PostCard post={post} viewerId={user.id} full />
    </div>
  );
}
