import { ArrowRight } from 'lucide-react';
import { useState } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { CopilotToggle, Focus } from './MessageInputActions';

const EmptyChatMessageInput = ({
  sendMessage,
  focusMode,
  setFocusMode,
}: {
  sendMessage: (message: string) => void;
  focusMode: string;
  setFocusMode: (mode: string) => void;
}) => {
  const [copilotEnabled, setCopilotEnabled] = useState(false);
  const [message, setMessage] = useState('');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        sendMessage(message);
        setMessage('');
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage(message);
          setMessage('');
        }
      }}
      className="w-full"
    >
      <div className="flex flex-col bg-primaryLight dark:bg-primaryDark px-5 pt-5 pb-2 rounded-lg w-full border border-light dark:border-dark">
        <TextareaAutosize
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          minRows={2}
          className="bg-transparent placeholder:text-black/50 dark:placeholder:text-white/50 text-sm text-black dark:text-white resize-none focus:outline-none w-full max-h-24 lg:max-h-36 xl:max-h-48"
          placeholder="Ask anything..."
        />
        <div className="flex flex-row items-center justify-between mt-4">
          <div className="flex flex-row items-center space-x-1 -mx-2">
            <Focus focusMode={focusMode} setFocusMode={setFocusMode} />
            {/* <Attach /> */}
          </div>
          <div className="flex flex-row items-center space-x-4 -mx-2">
            <CopilotToggle
              copilotEnabled={copilotEnabled}
              setCopilotEnabled={setCopilotEnabled}
            />
            <button
              disabled={message.trim().length === 0}
              className="bg-[#24A0ED] text-black dark:text-white disabled:text-black/50 dark:disabled:text-white/50 disabled:bg-[#e0e0dc] dark:disabled:bg-[#ececec21] hover:bg-opacity-85 transition duration-100 rounded-full p-2"
            >
              <ArrowRight className="bg-background" size={17} />
            </button>
          </div>
        </div>
      </div>
    </form>
  );
};

export default EmptyChatMessageInput;
