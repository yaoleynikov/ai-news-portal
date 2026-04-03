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
    return {
      slug,
      title: (data.title as string) || slug,
      date: (data.date as string) || '',
      excerpt: (data.excerpt as string) || '',
      coverImage: (data.coverImage as string) || '',
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

  const processedContent = remark().use(html, { allowDangerousHtml: true }).processSync(content);
  const contentHtml = processedContent.toString();

  return {
    slug,
    title: (data.title as string) || slug,
    date: data.date as string,
    excerpt: (data.excerpt as string) || '',
    coverImage: (data.coverImage as string) || '',
    tags: (data.tags as string[]) || [],
    author: (data.author as string) || 'AI-Insight',
    contentHtml,
    rawContent: content,
  };
}

export function getAllPostSlugs() {
  return getPostFiles().map(f => f.replace(/\.mdx?$/, ''));
}
