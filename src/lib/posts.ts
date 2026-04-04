import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { remark } from 'remark';
import html from 'remark-html';

const postsDir = path.join(process.cwd(), 'content/posts');

function getPostFiles() {
  if (!fs.existsSync(postsDir)) return [];
  return fs.readdirSync(postsDir).filter(f => f.endsWith('.md') || f.endsWith('.mdx'));
}

// Generate cover image URL
function getCoverImage(youtubeId: string, _title: string, tags: string[], slug: string): string {
  // 1. YouTube video thumbnail (1280x720) — primary source
  if (youtubeId) {
    return `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`;
  }
  // 2. Fallback: loremflickr with category-based keywords
  const tagMap: Record<string, string> = {
    'AI': 'technology',
    'Google': 'google',
    'Microsoft': 'microsoft',
    'OpenAI': 'technology',
    'Crypto': 'cryptocurrency',
    'Security': 'cybersecurity',
    'Energy': 'energy',
    'Data Centers': 'datacenter',
    'Policy': 'politics',
    'India': 'india',
    'SpaceX': 'space',
    'Startups': 'startup',
    'Cloud': 'cloud',
    'Hardware': 'processor',
    'Agents': 'robotics',
    'Wikipedia': 'book',
  };
  let category = 'technology';
  for (const tag of tags) {
    if (tagMap[tag]) { category = tagMap[tag]; break; }
  }
  const slugHash = slug.split('').reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 5381);
  return `https://loremflickr.com/g/800/500/${category}?lock=${Math.abs(slugHash)}`;
}

export function getSortedPosts() {
  const files = getPostFiles();
  const posts = files.map(filename => {
    const slug = filename.replace(/\.mdx?$/, '');
    const fullPath = path.join(postsDir, filename);
    const fileContents = fs.readFileSync(fullPath, 'utf8');
    const { data } = matter(fileContents);
    const tags = (data.tags as string[]) || [];
    const customCover = (data.coverImage as string) || '';
    const youtubeId = (data.youtubeId as string) || '';
    
    return {
      slug,
      title: (data.title as string) || slug,
      date: (data.date as string) || '',
      excerpt: (data.excerpt as string) || '',
      coverImage: customCover || getCoverImage(youtubeId, data.title as string, tags, slug),
      youtubeId: youtubeId || null,
      tags,
    };
  });
  return posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function getPostBySlug(slug: string) {
  const fullPath = path.join(postsDir, `${slug}.md`);
  const mdxPath = path.join(postsDir, `${slug}.mdx`);
  const filePath = fs.existsSync(fullPath) ? fullPath : fs.existsSync(mdxPath) ? mdxPath : null;
  if (!filePath) return null;

  const fileContents = fs.readFileSync(filePath, 'utf8');
  const { data, content } = matter(fileContents);
  const tags = (data.tags as string[]) || [];
  const customCover = (data.coverImage as string) || '';
  const youtubeId = (data.youtubeId as string) || '';

  const finalYoutubeId = youtubeId || null;
  let finalContent = content;

  // Add YouTube embed if youtubeId exists
  if (finalYoutubeId) {
    const firstH2 = content.indexOf('## ');
    if (firstH2 > 0) {
      const before = content.substring(0, firstH2);
      const after = content.substring(firstH2);
      finalContent = before + '\n<iframe width="100%" height="380" src="https://www.youtube.com/embed/' + finalYoutubeId + '?rel=0" title="YouTube video" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>\n\n' + after;
    }
  }

  const processedContent = remark().use(html, { allowDangerousHtml: true }).processSync(finalContent);
  const contentHtml = processedContent.toString();

  return {
    slug,
    title: (data.title as string) || slug,
    date: data.date as string,
    excerpt: (data.excerpt as string) || '',
    coverImage: customCover || getCoverImage(youtubeId, data.title as string, tags, slug),
    tags,
    author: (data.author as string) || 'SiliconFeed',
    source: (data.source as string) || '',
    contentHtml,
    rawContent: content,
    youtubeId: finalYoutubeId,
  };
}

export function getAllPostSlugs() {
  return getPostFiles().map(f => f.replace(/\.mdx?$/, ''));
}
