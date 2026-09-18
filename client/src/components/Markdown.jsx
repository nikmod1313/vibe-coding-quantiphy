import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CopyIcon, CheckIcon } from './Icons';

const CodeBlock = ({ className, children }) => {
  const [copied, setCopied] = useState(false);
  const lang = /language-(\w+)/.exec(className ?? '')?.[1];
  const code = String(children).replace(/\n$/, '');

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="codeblock">
      <div className="codeblock__bar">
        <span>{lang ?? 'code'}</span>
        <button className="codeblock__copy" onClick={copy}>{copied ? <><CheckIcon /> copied</> : <><CopyIcon /> copy</>}</button>
      </div>
      <pre><code className={className}>{code}</code></pre>
    </div>
  );
};

const components = {
  code({ inline, className, children, node, ...props }) {
    const isBlock = node?.position && String(children).includes('\n') || className;
    if (!inline && isBlock) return <CodeBlock className={className}>{children}</CodeBlock>;
    return <code {...props}>{children}</code>;
  },
  pre({ children }) { return <>{children}</>; },
  a({ children, ...props }) { return <a target="_blank" rel="noreferrer" {...props}>{children}</a>; },
};

export const Markdown = ({ children }) => (
  <div className="md">
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{children}</ReactMarkdown>
  </div>
);
