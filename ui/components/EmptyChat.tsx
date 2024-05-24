import EmptyChatMessageInput from './EmptyChatMessageInput';

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
    <div className="flex flex-col items-center justify-center min-h-screen max-w-screen-sm mx-auto p-2 space-y-8">
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
