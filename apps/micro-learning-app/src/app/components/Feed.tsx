import React from 'react';
import { CodingTip } from '../types';
import TipCard from './TipCard';

const MOCK_TIPS: CodingTip[] = [
  {
    id: '1',
    title: 'Use `map()` for Cleaner Lists',
    description: 'Stop using for-loops to transform arrays. `map()` is declarative and keeps your code readable.',
    author: 'js_wizard',
    videoUrl: 'https://example.com/video1',
    likes: 1240,
  },
  {
    id: '2',
    title: 'CSS Grid: The Ultimate Layout',
    description: 'Master `grid-template-areas` to build complex layouts in seconds without nesting divs.',
    author: 'css_pro',
    videoUrl: 'https://example.com/video2',
    likes: 856,
  },
  {
    id: '3',
    title: 'Async/Await vs Promises',
    description: 'Use `async/await` for flatter, more readable asynchronous code. Don\'t forget your try/catch!',
    author: 'node_ninja',
    videoUrl: 'https://example.com/video3',
    likes: 2100,
  },
  {
    id: '4',
    title: 'Destructuring in React',
    description: 'Keep your components clean by destructuring props right in the function signature.',
    author: 'react_dev',
    videoUrl: 'https://example.com/video4',
    likes: 3400,
  },
  {
    id: '5',
    title: 'TypeScript Utility Types',
    description: '`Pick`, `Omit`, and `Partial` can save you from rewriting interfaces. Use them wisely!',
    author: 'ts_guru',
    videoUrl: 'https://example.com/video5',
    likes: 1890,
  },
];

export default function Feed() {
  return (
    <div className="feed-container">
      {MOCK_TIPS.map((tip) => (
        <TipCard key={tip.id} tip={tip} />
      ))}
    </div>
  );
}
