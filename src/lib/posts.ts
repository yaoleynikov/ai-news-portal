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

export function getSortedPosts() {
  const files = getPostFiles();
  const posts = files.map(filename => {
    const slug = filename.replace(/\.mdx?$/, '');
    const fullPath = path.join(postsDir, filename);
    const fileContents = fs.readFileSync(fullPath, 'utf8');
    const { data } = matter(fileContents);
    let coverImage = (data.coverImage as string) || '';
    const youtubeId = (data.youtubeId as string) || '';
    
    // Use YouTube thumbnail as cover if available and no custom cover
    if (!coverImage && youtubeId) {
      coverImage = `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`;
    }
    
    return {
      slug,
      title: (data.title as string) || slug,
      date: (data.date as string) || '',
      excerpt: (data.excerpt as string) || '',
      coverImage,
      youtubeId,
      tags: (data.tags as string[]) || [],
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
  let coverImage = (data.coverImage as string) || '';
  const youtubeId = (data.youtubeId as string) || '';
  if (!coverImage && youtubeId) {
    coverImage = `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`;
  }

  // Add YouTube iframe to the beginning of content if youtubeId exists
  let finalContent = content;
  if (youtubeId) {
    const ytEmbed = `\n\n<iframe width="100%" height="360" src="https://www.youtube.com/embed/${youtubeId}?rel=0" title="YouTube video" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>\n\n`;
    // Insert after first paragraph
    const firstBreak = content.indexOf('\n\n');
    if (firstBreak > 0) {
      finalContent = content.substring(0, firstBreak) + ytEmbed + content.substring(firstBreak);
    }
  }

  const processedContent = remark().use(html, { allowDangerousHtml: true }).processSync(finalContent);
  const contentHtml = processedContent.toString();

  return {
    slug,
    title: (data.title as string) || slug,
    date: data.date as string,
    excerpt: (data.excerpt as string) || '',
    coverImage,
    tags: (data.tags as string[]) || [],
    author: (data.author as string) || 'SiliconFeed',
    contentHtml,
    rawContent: content,
    youtubeId,
  };
}

export function getAllPostSlugs() {
  return getPostFiles().map(f => f.replace(/\.mdx?$/, ''));
}
