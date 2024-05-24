const MessageBoxLoading = () => {
  return (
    <div className="flex flex-col space-y-2 w-full lg:w-9/12 bg-primaryLight dark:bg-primaryDark animate-pulse rounded-lg p-3">
      <div className="h-2 rounded-full w-full bg-secondLight dark:bg-secondDark" />
      <div className="h-2 rounded-full w-9/12 bg-secondLight dark:bg-secondDark" />
      <div className="h-2 rounded-full w-10/12 bg-secondLight dark:bg-secondDark" />
    </div>
  );
};

export default MessageBoxLoading;
