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
    <div className="mx-auto max-w-screen-2xl fixed z-40 top-0 left-0 right-0 px-4 lg:pr-6 lg:px-8 flex flex-row items-center justify-between w-full py-4 text-sm text-black dark:text-white/70 border-b bg-light-primary dark:bg-dark-primary border-light-100 dark:border-dark-200">
      <a
        href="/"
        className="active:scale-95 transition duration-100 cursor-pointer lg:hidden"
      >
        <Edit size={17} />
      </a>
      <div className="hidden lg:flex flex-row items-center justify-center space-x-2">
        <Clock size={17} />
        <p className="text-xs">{timeAgo} ago</p>
      </div>
      <p className="hidden lg:flex">{title}</p>

      <div className="flex flex-row items-center space-x-4">
        <Popover className="relative">
          <PopoverButton className="active:scale-95 transition duration-100 cursor-pointer p-2 rounded-full hover:bg-light-secondary dark:hover:bg-dark-secondary">
            <Share size={17} />
          </PopoverButton>
          <Transition
            as={Fragment}
            enter="transition ease-out duration-100"
            enterFrom="opacity-0 translate-y-1"
            enterTo="opacity-100 translate-y-0"
            leave="transition ease-in duration-75"
            leaveFrom="opacity-100 translate-y-0"
            leaveTo="opacity-0 translate-y-1"
          >
            <PopoverPanel className="absolute right-0 mt-2 w-64 rounded-xl shadow-xl bg-light-primary dark:bg-dark-primary border border-light-200 dark:border-dark-200 z-50">
              <div className="flex flex-col py-3 px-3 gap-2">
                <button
                  className="flex items-center gap-2 px-4 py-2 text-left hover:bg-light-secondary dark:hover:bg-dark-secondary transition-colors text-black dark:text-white rounded-lg font-medium"
                  onClick={() => exportAsMarkdown(sections, title || '')}
                >
                  <FileText size={17} className="text-[#24A0ED]" />
                  Export as Markdown
                </button>
                <button
                  className="flex items-center gap-2 px-4 py-2 text-left hover:bg-light-secondary dark:hover:bg-dark-secondary transition-colors text-black dark:text-white rounded-lg font-medium"
                  onClick={() => exportAsPDF(sections, title || '')}
                >
                  <FileDown size={17} className="text-[#24A0ED]" />
                  Export as PDF
                </button>
              </div>
            </PopoverPanel>
          </Transition>
        </Popover>
        <DeleteChat redirect chatId={chatId!} chats={[]} setChats={() => {}} />
      </div>
    </div>
  );
};

export default Navbar;
