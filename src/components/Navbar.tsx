import { Clock, Edit, Share, Trash, FileText, FileDown } from 'lucide-react';
import { Message } from './ChatWindow';
import { useSyncExternalStore, Fragment } from 'react';
import { getTimeDifference } from '@/lib/utils';
import DeleteChat from './DeleteChat';
import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
} from '@headlessui/react';
import { useChat, Section } from '@/lib/hooks/useChat';
import { SourceBlock } from '@/lib/types';
import { useTranslations } from 'next-intl';

const downloadFile = (filename: string, content: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
};

type ExportLabels = {
  chatExport: string;
  exportedOn: string;
  user: string;
  assistant: string;
  citations: string;
};

const exportAsMarkdown = (
  sections: Section[],
  title: string,
  labels: ExportLabels,
) => {
  const date = new Date(
    sections[0].message.createdAt || Date.now(),
  ).toLocaleString();
  let md = `# 💬 ${labels.chatExport}: ${title}\n\n`;
  md += `*${labels.exportedOn}: ${date}*\n\n---\n`;

  sections.forEach((section, idx) => {
    md += `\n---\n`;
    md += `**🧑 ${labels.user}**  
`;
    md += `*${new Date(section.message.createdAt).toLocaleString()}*\n\n`;
    md += `> ${section.message.query.replace(/\n/g, '\n> ')}\n`;

    if (section.message.responseBlocks.length > 0) {
      md += `\n---\n`;
      md += `**🤖 ${labels.assistant}**  
`;
      md += `*${new Date(section.message.createdAt).toLocaleString()}*\n\n`;
      md += `> ${section.message.responseBlocks
        .filter((b) => b.type === 'text')
        .map((block) => block.data)
        .join('\n')
        .replace(/\n/g, '\n> ')}\n`;
    }

    const sourceResponseBlock = section.message.responseBlocks.find(
      (block) => block.type === 'source',
    ) as SourceBlock | undefined;

    if (
      sourceResponseBlock &&
      sourceResponseBlock.data &&
      sourceResponseBlock.data.length > 0
    ) {
      md += `\n**${labels.citations}:**\n`;
      sourceResponseBlock.data.forEach((src: any, i: number) => {
        const url = src.metadata?.url || '';
        md += `- [${i + 1}] [${url}](${url})\n`;
      });
    }
  });
  md += '\n---\n';
  downloadFile(`${title || 'chat'}.md`, md, 'text/markdown');
};

const exportAsPDF = async (
  sections: Section[],
  title: string,
  labels: ExportLabels,
) => {
  // jspdf (~320 KB) só é baixado quando o usuário exporta.
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  const date = new Date(
    sections[0]?.message?.createdAt || Date.now(),
  ).toLocaleString();
  let y = 15;
  const pageHeight = doc.internal.pageSize.height;
  doc.setFontSize(18);
  doc.text(`${labels.chatExport}: ${title}`, 10, y);
  y += 8;
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`${labels.exportedOn}: ${date}`, 10, y);
  y += 8;
  doc.setDrawColor(200);
  doc.line(10, y, 200, y);
  y += 6;
  doc.setTextColor(30);

  sections.forEach((section, idx) => {
    if (y > pageHeight - 30) {
      doc.addPage();
      y = 15;
    }
    doc.setFont('helvetica', 'bold');
    doc.text(labels.user, 10, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(`${new Date(section.message.createdAt).toLocaleString()}`, 40, y);
    y += 6;
    doc.setTextColor(30);
    doc.setFontSize(12);
    const userLines = doc.splitTextToSize(section.message.query, 180);
    for (let i = 0; i < userLines.length; i++) {
      if (y > pageHeight - 20) {
        doc.addPage();
        y = 15;
      }
      doc.text(userLines[i], 12, y);
      y += 6;
    }
    y += 6;
    doc.setDrawColor(230);
    if (y > pageHeight - 10) {
      doc.addPage();
      y = 15;
    }
    doc.line(10, y, 200, y);
    y += 4;

    if (section.message.responseBlocks.length > 0) {
      if (y > pageHeight - 30) {
        doc.addPage();
        y = 15;
      }
      doc.setFont('helvetica', 'bold');
      doc.text(labels.assistant, 10, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(120);
      doc.text(
        `${new Date(section.message.createdAt).toLocaleString()}`,
        40,
        y,
      );
      y += 6;
      doc.setTextColor(30);
      doc.setFontSize(12);
      const assistantLines = doc.splitTextToSize(
        section.parsedTextBlocks.join('\n'),
        180,
      );
      for (let i = 0; i < assistantLines.length; i++) {
        if (y > pageHeight - 20) {
          doc.addPage();
          y = 15;
        }
        doc.text(assistantLines[i], 12, y);
        y += 6;
      }

      const sourceResponseBlock = section.message.responseBlocks.find(
        (block) => block.type === 'source',
      ) as SourceBlock | undefined;

      if (
        sourceResponseBlock &&
        sourceResponseBlock.data &&
        sourceResponseBlock.data.length > 0
      ) {
        doc.setFontSize(11);
        doc.setTextColor(80);
        if (y > pageHeight - 20) {
          doc.addPage();
          y = 15;
        }
        doc.text(`${labels.citations}:`, 12, y);
        y += 5;
        sourceResponseBlock.data.forEach((src: any, i: number) => {
          const url = src.metadata?.url || '';
          if (y > pageHeight - 15) {
            doc.addPage();
            y = 15;
          }
          doc.text(`- [${i + 1}] ${url}`, 15, y);
          y += 5;
        });
        doc.setTextColor(30);
      }
      y += 6;
      doc.setDrawColor(230);
      if (y > pageHeight - 10) {
        doc.addPage();
        y = 15;
      }
      doc.line(10, y, 200, y);
      y += 4;
    }
  });
  doc.save(`${title || 'chat'}.pdf`);
};

const subscribeToClock = (onTick: () => void) => {
  const intervalId = setInterval(onTick, 1000);
  return () => clearInterval(intervalId);
};

const Navbar = () => {
  const t = useTranslations('Navbar');
  const tt = useTranslations('TimeAgo');
  const exportLabels: ExportLabels = {
    chatExport: t('chatExport'),
    exportedOn: t('exportedOn'),
    user: t('user'),
    assistant: t('assistant'),
    citations: t('citations'),
  };
  const { sections, chatId } = useChat();

  const firstMessage = sections[0]?.message;
  const title = firstMessage
    ? firstMessage.query.length > 30
      ? `${firstMessage.query.substring(0, 30).trim()}...`
      : firstMessage.query || t('newConversation')
    : '';

  // "x minutes ago" for the first message, read from a one-second clock.
  // React re-renders only when the label text changes; '' on the server.
  const timeAgo = useSyncExternalStore(
    subscribeToClock,
    () => {
      if (!firstMessage) return '';
      const { unit, count } = getTimeDifference(
        new Date(),
        firstMessage.createdAt,
      );
      return tt(unit, { count });
    },
    () => '',
  );

  return (
    <div className="sticky -mx-4 lg:mx-0 top-0 z-40 bg-light-primary/95 dark:bg-dark-primary/95 backdrop-blur-sm border-b border-light-200/50 dark:border-dark-200/30">
      <div className="px-4 lg:px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center min-w-0">
            {/* Full reload on purpose: it resets the chat state kept by ChatProvider. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              className="lg:hidden mr-3 p-2 -ml-2 rounded-lg hover:bg-light-secondary dark:hover:bg-dark-secondary transition-colors duration-200"
            >
              <Edit size={18} className="text-black/70 dark:text-white/70" />
            </a>
            <div className="hidden lg:flex items-center gap-2 text-black/50 dark:text-white/50 min-w-0">
              <Clock size={14} />
              <span className="text-xs whitespace-nowrap">{timeAgo}</span>
            </div>
          </div>

          <div className="flex-1 mx-4 min-w-0">
            <h1 className="text-center text-sm font-medium text-black/80 dark:text-white/90 truncate">
              {title || t('newConversation')}
            </h1>
          </div>

          <div className="flex items-center gap-1 min-w-0">
            <Popover className="relative">
              <PopoverButton className="p-2 rounded-lg hover:bg-light-secondary dark:hover:bg-dark-secondary transition-colors duration-200">
                <Share size={16} className="text-black/60 dark:text-white/60" />
              </PopoverButton>
              <Transition
                as={Fragment}
                enter="transition ease-out duration-200"
                enterFrom="opacity-0 translate-y-1"
                enterTo="opacity-100 translate-y-0"
                leave="transition ease-in duration-150"
                leaveFrom="opacity-100 translate-y-0"
                leaveTo="opacity-0 translate-y-1"
              >
                <PopoverPanel className="absolute right-0 mt-2 w-64 origin-top-right rounded-2xl bg-light-primary dark:bg-dark-primary border border-light-200 dark:border-dark-200 shadow-xl shadow-black/10 dark:shadow-black/30 z-50">
                  <div className="p-3">
                    <div className="mb-2">
                      <p className="text-xs font-medium text-black/40 dark:text-white/40 uppercase tracking-wide">
                        {t('exportChat')}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <button
                        className="w-full flex items-center gap-3 px-3 py-2 text-left rounded-xl hover:bg-light-secondary dark:hover:bg-dark-secondary transition-colors duration-200"
                        onClick={() =>
                          exportAsMarkdown(sections, title || '', exportLabels)
                        }
                      >
                        <FileText size={16} className="text-[#24A0ED]" />
                        <div>
                          <p className="text-sm font-medium text-black dark:text-white">
                            Markdown
                          </p>
                          <p className="text-xs text-black/50 dark:text-white/50">
                            {t('markdownFormat')}
                          </p>
                        </div>
                      </button>
                      <button
                        className="w-full flex items-center gap-3 px-3 py-2 text-left rounded-xl hover:bg-light-secondary dark:hover:bg-dark-secondary transition-colors duration-200"
                        onClick={() => {
                          exportAsPDF(
                            sections,
                            title || '',
                            exportLabels,
                          ).catch((err) =>
                            console.error('PDF export failed:', err),
                          );
                        }}
                      >
                        <FileDown size={16} className="text-[#24A0ED]" />
                        <div>
                          <p className="text-sm font-medium text-black dark:text-white">
                            PDF
                          </p>
                          <p className="text-xs text-black/50 dark:text-white/50">
                            {t('pdfFormat')}
                          </p>
                        </div>
                      </button>
                    </div>
                  </div>
                </PopoverPanel>
              </Transition>
            </Popover>
            <DeleteChat
              redirect
              chatId={chatId!}
              chats={[]}
              setChats={() => {}}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Navbar;
