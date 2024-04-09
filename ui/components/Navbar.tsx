import { Clock, Edit, Share, Trash } from 'lucide-react';

const Navbar = () => {
  return (
    <div className="fixed z-40 top-0 left-0 right-0 px-4 lg:pl-32 lg:pr-4 lg:px-8 flex flex-row items-center justify-between w-full py-4 text-sm text-white/70 border-b bg-[#0A0A0A] border-[#1C1C1C]">
      <Edit
        size={17}
        className="active:scale-95 transition duration-100 cursor-pointer lg:hidden"
      />
      <div className="hidden lg:flex flex-row items-center space-x-2">
        <Clock size={17} />
        <p className="text-xs">15 minutes ago</p>
      </div>
      <p className="hidden lg:flex">Blog on AI</p>
      <div className="flex flex-row items-center space-x-4">
        <Share
          size={17}
          className="active:scale-95 transition duration-100 cursor-pointer"
        />
        <Trash
          size={17}
          className="text-red-400 active:scale-95 transition duration-100 cursor-pointer"
        />
      </div>
    </div>
  );
};

export default Navbar;
