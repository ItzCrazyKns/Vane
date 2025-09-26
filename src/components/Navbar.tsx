import { Clock, Edit, Share, Trash, FileText, FileDown } from 'lucide-react';
import { Message } from './ChatWindow';
import { useEffect, useState, Fragment } from 'react';
import { formatTimeDifference } from '@/lib/utils';
import DeleteChat from './DeleteChat';
import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
} from '@headlessui/react';
import jsPDF from 'jspdf';
import { useChat, Section } from '@/lib/hooks/useChat';

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

const exportAsMarkdown = (sections: Section[], title: string) => {
  const date = new Date(
    sections[0]?.userMessage?.createdAt || Date.now(),
  ).toLocaleString();
  let md = `# 💬 Chat Export: ${title}\n\n`;
  md += `*Exported on: ${date}*\n\n---\n`;

  sections.forEach((section, idx) => {
    if (section.userMessage) {
      md += `\n---\n`;
      md += `**🧑 User**  
`;
      md += `*${new Date(section.userMessage.createdAt).toLocaleString()}*\n\n`;
      md += `> ${section.userMessage.content.replace(/\n/g, '\n> ')}\n`;
    }

    if (section.assistantMessage) {
      md += `\n---\n`;
      md += `**🤖 Assistant**  
`;
      md += `*${new Date(section.assistantMessage.createdAt).toLocaleString()}*\n\n`;
      md += `> ${section.assistantMessage.content.replace(/\n/g, '\n> ')}\n`;
    }

    if (
      section.sourceMessage &&
      section.sourceMessage.sources &&
      section.sourceMessage.sources.length > 0
    ) {
      md += `\n**Citations:**\n`;
      section.sourceMessage.sources.forEach((src: any, i: number) => {
        const url = src.metadata?.url || '';
        md += `- [${i + 1}] [${url}](${url})\n`;
      });
    }
  });
  md += '\n---\n';
  downloadFile(`${title || 'chat'}.md`, md, 'text/markdown');
};

const exportAsPDF = (sections: Section[], title: string) => {
  const doc = new jsPDF();
  const date = new Date(
    sections[0]?.userMessage?.createdAt || Date.now(),
  ).toLocaleString();
  let y = 15;
  const pageHeight = doc.internal.pageSize.height;
  doc.setFontSize(18);
  doc.text(`Chat Export: ${title}`, 10, y);
  y += 8;
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`Exported on: ${date}`, 10, y);
  y += 8;
  doc.setDrawColor(200);
  doc.line(10, y, 200, y);
  y += 6;
  doc.setTextColor(30);

  sections.forEach((section, idx) => {
    if (section.userMessage) {
      if (y > pageHeight - 30) {
        doc.addPage();
        y = 15;
      }
      doc.setFont('helvetica', 'bold');
      doc.text('User', 10, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(120);
      doc.text(
        `${new Date(section.userMessage.createdAt).toLocaleString()}`,
        40,
        y,
      );
      y += 6;
      doc.setTextColor(30);
      doc.setFontSize(12);
      const userLines = doc.splitTextToSize(section.userMessage.content, 180);
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
    }

    if (section.assistantMessage) {
      if (y > pageHeight - 30) {
        doc.addPage();
        y = 15;
      }
      doc.setFont('helvetica', 'bold');
      doc.text('Assistant', 10, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(120);
      doc.text(
        `${new Date(section.assistantMessage.createdAt).toLocaleString()}`,
        40,
        y,
      );
      y += 6;
      doc.setTextColor(30);
      doc.setFontSize(12);
      const assistantLines = doc.splitTextToSize(
        section.assistantMessage.content,
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

      if (
        section.sourceMessage &&
        section.sourceMessage.sources &&
        section.sourceMessage.sources.length > 0
      ) {
        doc.setFontSize(11);
        doc.setTextColor(80);
        if (y > pageHeight - 20) {
          doc.addPage();
          y = 15;
        }
        doc.text('Citations:', 12, y);
        y += 5;
        section.sourceMessage.sources.forEach((src: any, i: number) => {
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

const Navbar = () => {
  const [title, setTitle] = useState<string>('');
  const [timeAgo, setTimeAgo] = useState<string>('');

  const { sections, chatId } = useChat();

  useEffect(() => {
    if (sections.length > 0 && sections[0].userMessage) {
      const newTitle =
        sections[0].userMessage.content.length > 20
          ? `${sections[0].userMessage.content.substring(0, 20).trim()}...`
          : sections[0].userMessage.content;
      setTitle(newTitle);
      const newTimeAgo = formatTimeDifference(
        new Date(),
        sections[0].userMessage.createdAt,
      );
      setTimeAgo(newTimeAgo);
    }
  }, [sections]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (sections.length > 0 && sections[0].userMessage) {
        const newTimeAgo = formatTimeDifference(
          new Date(),
          sections[0].userMessage.createdAt,
        );
        setTimeAgo(newTimeAgo);
      }
    }, 1000);

    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="sticky -mx-4 lg:mx-0 top-0 z-40 bg-light-primary/95 dark:bg-dark-primary/95 backdrop-blur-sm border-b border-light-200/50 dark:border-dark-200/30">
      <div className="px-4 lg:px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center min-w-0">
            <a
              href="/"
              className="lg:hidden mr-3 p-2 -ml-2 rounded-lg hover:bg-light-secondary dark:hover:bg-dark-secondary transition-colors duration-200"
            >
              <Edit size={18} className="text-black/70 dark:text-white/70" />
            </a>
            <div className="hidden lg:flex items-center gap-2 text-black/50 dark:text-white/50 min-w-0">
              <Clock size={14} />
              <span className="text-xs whitespace-nowrap">{timeAgo} ago</span>
            </div>
          </div>

          <div className="flex-1 mx-4 min-w-0">
            <h1 className="text-center text-sm font-medium text-black/80 dark:text-white/90 truncate">
              {title || 'New Conversation'}
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
                        Export Chat
                      </p>
                    </div>
                    <div className="space-y-1">
                      <button
                        className="w-full flex items-center gap-3 px-3 py-2 text-left rounded-xl hover:bg-light-secondary dark:hover:bg-dark-secondary transition-colors duration-200"
                        onClick={() => exportAsMarkdown(sections, title || '')}
                      >
                        <FileText size={16} className="text-[#24A0ED]" />
                        <div>
                          <p className="text-sm font-medium text-black dark:text-white">
                            Markdown
                          </p>
                          <p className="text-xs text-black/50 dark:text-white/50">
                            .md format
                          </p>
                        </div>
                      </button>
                      <button
                        className="w-full flex items-center gap-3 px-3 py-2 text-left rounded-xl hover:bg-light-secondary dark:hover:bg-dark-secondary transition-colors duration-200"
                        onClick={() => exportAsPDF(sections, title || '')}
                      >
                        <FileDown size={16} className="text-[#24A0ED]" />
                        <div>
                          <p className="text-sm font-medium text-black dark:text-white">
                            PDF
                          </p>
                          <p className="text-xs text-black/50 dark:text-white/50">
                            Document format
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
