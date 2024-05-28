import EmptyChatMessageInput from './EmptyChatMessageInput';
import { ThemeSwitcher } from './theme/Switcher';

const EmptyChat = ({
  sendMessage,
  focusMode,
  setFocusMode,
}: {
  sendMessage: (message: string) => void;
  focusMode: string;
  setFocusMode: (mode: string) => void;
}) => {
  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen max-w-screen-sm mx-auto p-2 space-y-8">
      <ThemeSwitcher size={17} className="absolute top-2 right-0 lg:hidden" />
      <h2 className="text-black/70 dark:text-white/70 text-3xl font-medium -mt-8">
        Research begins here.
      </h2>
      <EmptyChatMessageInput
        sendMessage={sendMessage}
        focusMode={focusMode}
        setFocusMode={setFocusMode}
      />
    </div>
  );
};

export default EmptyChat;
