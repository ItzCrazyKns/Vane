const MessageBoxLoading = () => {
  return (
    <div className="flex flex-col space-y-2 w-full lg:w-9/12 bg-[#111111] animate-pulse rounded-lg p-3">
      <div className="h-2 rounded-full w-full bg-[#1c1c1c]" />
      <div className="h-2 rounded-full w-9/12 bg-[#1c1c1c]" />
      <div className="h-2 rounded-full w-10/12 bg-[#1c1c1c]" />
    </div>
  );
};

export default MessageBoxLoading;
