'use client';

import { useEffect, useState } from 'react';
import { UIConfigSections } from '@/lib/config/types';
import { AnimatePresence, motion } from 'framer-motion';
import SetupConfig from './SetupConfig';

const SetupWizard = ({
  configSections,
}: {
  configSections: UIConfigSections;
}) => {
  const [showWelcome, setShowWelcome] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [setupState, setSetupState] = useState(1);

  const delay = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  useEffect(() => {
    (async () => {
      await delay(2500);
      setShowWelcome(false);
      await delay(600);
      setShowSetup(true);
      setSetupState(1);
      await delay(1500);
      setSetupState(2);
    })();
  }, []);

  return (
    <div className="bg-light-primary dark:bg-dark-primary h-screen w-screen fixed inset-0 overflow-hidden">
      <AnimatePresence>
        {showWelcome && (
          <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
            <motion.div
              className="absolute flex flex-col items-center justify-center h-full"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              transition={{ duration: 0.6 }}
            >
              <motion.h2
                transition={{ duration: 0.6 }}
                initial={{ opacity: 0, translateY: '30px' }}
                animate={{ opacity: 1, translateY: '0px' }}
                className="text-4xl md:text-6xl xl:text-8xl font-normal font-['Instrument_Serif'] tracking-tight"
              >
                Welcome to{' '}
                <span className="text-[#24A0ED] italic font-['PP_Editorial']">
                  Perplexica
                </span>
              </motion.h2>
              <motion.p
                transition={{ delay: 0.8, duration: 0.7 }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-black/70 dark:text-white/70 text-sm md:text-lg xl:text-2xl mt-2"
              >
                <span className="font-light">Web search,</span>{' '}
                <span className="font-light font-['PP_Editorial'] italic">
                  reimagined
                </span>
              </motion.p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{
                opacity: 0.2,
                scale: 1,
                transition: { delay: 0.8, duration: 0.7 },
              }}
              exit={{ opacity: 0, scale: 1.1, transition: { duration: 0.6 } }}
              className="bg-[#24A0ED] left-50 translate-x-[-50%] h-[250px] w-[250px] rounded-full relative z-40 blur-[100px]"
            />
          </div>
        )}
        {showSetup && (
          <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
            <AnimatePresence mode="wait">
              {setupState === 1 && (
                <motion.p
                  key="setup-text"
                  transition={{ duration: 0.6 }}
                  initial={{ opacity: 0, translateY: '30px' }}
                  animate={{ opacity: 1, translateY: '0px' }}
                  exit={{
                    opacity: 0,
                    translateY: '-30px',
                    transition: { duration: 0.6 },
                  }}
                  className="text-2xl md:text-4xl xl:text-6xl font-normal font-['Instrument_Serif'] tracking-tight"
                >
                  Let us get{' '}
                  <span className="text-[#24A0ED] italic font-['PP_Editorial']">
                    Perplexica
                  </span>{' '}
                  set up for you
                </motion.p>
              )}
              {setupState > 1 && (
                <motion.div
                  key="setup-config"
                  initial={{ opacity: 0, translateY: '30px' }}
                  animate={{
                    opacity: 1,
                    translateY: '0px',
                    transition: { duration: 0.6 },
                  }}
                >
                  <SetupConfig
                    configSections={configSections}
                    setupState={setupState}
                    setSetupState={setSetupState}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SetupWizard;
