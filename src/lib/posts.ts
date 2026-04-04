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
