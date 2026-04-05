import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { remark } from 'remark';
import html from 'remark-html';

const postsDir = path.join(process.cwd(), 'content/posts');
const coversDir = path.join(process.cwd(), 'public/covers');

function resolveCover(slug: string, title: string, tag: string): string {
  // 1) Pre-generated JPG in public/covers/
  const jpgPath = path.join(coversDir, `${slug}.jpg`);
  if (fs.existsSync(jpgPath)) {
    return `/covers/${slug}.jpg`;
  }
  // 2) Dynamic SVG fallback
  return `/api/cover?title=${encodeURIComponent(title)}&tag=${encodeURIComponent(tag)}`;
}

function getPostFiles() {
  if (!fs.existsSync(postsDir)) return [];
  return fs.readdirSync(postsDir).filter(f => f.endsWith('.md') || f.endsWith('.mdx'));
}

export function getSortedPosts() {
  const files = getPostFiles();
  const posts = files.map(filename => {
    const slug = filename.replace(/\.mdx?$/, '');
    const fullPath = path.join(postsDir, filename);
    const fileContents = fs.readFileSync(fullPath, 'utf8');
    const { data } = matter(fileContents);
    const tags = (data.tags as string[]) || [];
    const tag = tags[0] || 'Tech';
    const coverUrl = resolveCover(slug, data.title as string, tag);
    
    return {
      slug,
      title: (data.title as string) || slug,
      date: (data.date as string) || '',
      excerpt: (data.excerpt as string) || '',
      coverImage: coverUrl,
      coverAlt: data.title as string,
      tag,
      youtubeId: (data.youtubeId as string) || null,
      tags,
    };
  });
  return posts.sort((a, b) => {
    const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
    if (dateDiff !== 0) return dateDiff;
    // Same date — sort by slug (filename) so later articles appear first
    return b.slug.localeCompare(a.slug);
  });
}

export function getPostBySlug(slug: string) {
  const fullPath = path.join(postsDir, `${slug}.md`);
  const mdxPath = path.join(postsDir, `${slug}.mdx`);
  const filePath = fs.existsSync(fullPath) ? fullPath : fs.existsSync(mdxPath) ? mdxPath : null;
  if (!filePath) return null;

  const fileContents = fs.readFileSync(filePath, 'utf8');
  const { data, content } = matter(fileContents);
  const tags = (data.tags as string[]) || [];
  const tag = tags[0] || 'Tech';
  const coverUrl = resolveCover(slug, data.title as string, tag);

  // Parse coverImage from frontmatter if present
  const customCover = (data.coverImage as string) || '';

  let finalContent = content;

  const youtubeId = (data.youtubeId as string) || null;
  if (youtubeId) {
    const firstH2 = content.indexOf('## ');
    if (firstH2 > 0) {
      const before = content.substring(0, firstH2);
      const after = content.substring(firstH2);
      finalContent = before + '\n<iframe width="100%" height="380" src="https://www.youtube.com/embed/' + youtubeId + '?rel=0" title="YouTube video" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>\n\n' + after;
    }
  }

  const processedContent = remark().use(html, { allowDangerousHtml: true }).processSync(finalContent);
  const contentHtml = processedContent.toString();

  return {
    slug,
    title: (data.title as string) || slug,
    date: data.date as string,
    excerpt: (data.excerpt as string) || '',
    coverImage: customCover || coverUrl,
    coverAlt: data.title as string,
    tag,
    tags,
    author: (data.author as string) || 'SiliconFeed',
    source: (data.source as string) || '',
    contentHtml,
    rawContent: content,
    youtubeId,
  };
}

export function getAllPostSlugs() {
  return getPostFiles().map(f => f.replace(/\.mdx?$/, ''));
}

export function getAllTags(): string[] {
  const files = getPostFiles();
  const tagSet = new Set<string>();
  for (const filename of files) {
    const fullPath = path.join(postsDir, filename);
    const fileContents = fs.readFileSync(fullPath, 'utf8');
    const { data } = matter(fileContents);
    const tags = (data.tags as string[]) || [];
    tags.forEach(t => tagSet.add(t));
  }
  return Array.from(tagSet).sort();
}
