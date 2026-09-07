import React, { useState } from 'react';
import { GitCommit, GitBranch, Check, Copy, ExternalLink } from 'lucide-react';
import {
  APP_VERSION,
  BRANCH_NAME,
  COMMIT_SHA,
  getFormattedBuildTime,
  getFullVersionSummary,
  copyVersionToClipboard,
  GITHUB_COMMIT_URL,
  GITHUB_BRANCH_URL,
} from '../version';

interface VersionBadgeProps {
  variant?: 'compact' | 'detailed' | 'minimal';
  className?: string;
}

export const VersionBadge: React.FC<VersionBadgeProps> = ({
  variant = 'compact',
  className = '',
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const success = await copyVersionToClipboard();
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formattedTime = getFormattedBuildTime();
  const hasCommit = Boolean(COMMIT_SHA && COMMIT_SHA !== 'dev');
  const hasBranch = Boolean(BRANCH_NAME);

  if (variant === 'minimal') {
    return (
      <button
        onClick={handleCopy}
        type="button"
        title={`${getFullVersionSummary()} (לחץ להעתקה)`}
        className={`inline-flex items-center gap-1 text-[10px] font-mono text-gray-500 hover:text-gray-300 transition-colors cursor-pointer select-none ${className}`}
      >
        <span>v{APP_VERSION}</span>
        {hasBranch && (
          <>
            <span>•</span>
            <span className="text-cyan-400/80">{BRANCH_NAME}</span>
          </>
        )}
        {hasCommit && (
          <>
            <span>•</span>
            <span className="text-emerald-500/80">{COMMIT_SHA}</span>
          </>
        )}
        {copied && <Check className="w-2.5 h-2.5 text-emerald-400" />}
      </button>
    );
  }

  if (variant === 'detailed') {
    return (
      <div
        className={`flex flex-col sm:flex-row items-center justify-between gap-2 px-3 py-2 bg-gray-900/60 border border-gray-800/80 rounded-xl text-[11px] text-gray-400 ${className}`}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-gray-300">shelv.ai</span>
          <span className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-300 font-mono text-[10px]">
            v{APP_VERSION}
          </span>
          {hasBranch && (
            <div className="flex items-center gap-1 font-mono text-[10px] text-cyan-400/90 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20">
              <GitBranch className="w-3 h-3" />
              <span>{BRANCH_NAME}</span>
            </div>
          )}
          {hasCommit && (
            <div className="flex items-center gap-1 font-mono text-[10px] text-emerald-400/90 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
              <GitCommit className="w-3 h-3" />
              <span>{COMMIT_SHA}</span>
            </div>
          )}
          {formattedTime && (
            <span className="text-gray-500 text-[10px]">
              נבנה: {formattedTime}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {GITHUB_BRANCH_URL && (
            <a
              href={GITHUB_BRANCH_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-cyan-400 transition-colors"
              title={`צפה בענף ${BRANCH_NAME} ב-GitHub`}
            >
              <GitBranch className="w-2.5 h-2.5" />
              <span>{BRANCH_NAME}</span>
            </a>
          )}
          {GITHUB_COMMIT_URL && (
            <a
              href={GITHUB_COMMIT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-emerald-400 transition-colors"
              title="צפה ב-commit ב-GitHub"
            >
              <span>GitHub</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
          <button
            onClick={handleCopy}
            type="button"
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-gray-800/80 hover:bg-gray-800 text-gray-300 hover:text-white transition-all cursor-pointer text-[10px]"
            title="העתק פרטי גרסה"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400 font-medium">הועתק!</span>
              </>
            ) : (
              <>
                <Copy className="w-2.5 h-2.5 text-gray-400" />
                <span>העתק</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // Default: compact pill badge for header / login
  const branchInfo = hasBranch ? ` (ענף: ${BRANCH_NAME})` : '';
  const commitInfo = hasCommit ? ` [Commit: ${COMMIT_SHA}]` : '';
  const timeInfo = formattedTime ? ` | נבנה ב: ${formattedTime}` : '';
  const tooltip = `גרסה v${APP_VERSION}${branchInfo}${commitInfo}${timeInfo} | לחץ להעתקה`;

  return (
    <button
      onClick={handleCopy}
      type="button"
      className={`group relative inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-mono font-medium bg-gray-900/90 hover:bg-gray-800 text-gray-300 border border-gray-800 hover:border-gray-700 transition-all cursor-pointer shadow-sm select-none ${className}`}
      title={tooltip}
    >
      <div className="flex items-center gap-1 text-gray-400 group-hover:text-gray-200">
        <GitCommit className="w-3 h-3 text-emerald-400 shrink-0" />
        <span>v{APP_VERSION}</span>
      </div>

      {hasBranch && (
        <>
          <span className="text-gray-600">|</span>
          <div className="flex items-center gap-0.5 text-cyan-400/90">
            <GitBranch className="w-2.5 h-2.5" />
            <span className="font-mono text-[9px] sm:text-[10px]">{BRANCH_NAME}</span>
          </div>
        </>
      )}

      {hasCommit && (
        <>
          <span className="text-gray-600">|</span>
          <span className="font-mono text-[9px] sm:text-[10px] text-emerald-400">
            {COMMIT_SHA}
          </span>
        </>
      )}

      {copied ? (
        <span className="flex items-center gap-0.5 text-emerald-400 font-sans font-semibold text-[9px] bg-emerald-500/20 px-1 rounded">
          <Check className="w-2.5 h-2.5" />
          <span>הועתק</span>
        </span>
      ) : (
        <Copy className="w-2.5 h-2.5 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      )}
    </button>
  );
};
