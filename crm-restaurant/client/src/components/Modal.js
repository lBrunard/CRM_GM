import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';

const Modal = ({ show, onHide, onClose, size = 'md', children }) => {
  const handleClose = onHide || onClose;
  
  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  };

  return (
    <Transition appear show={show} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className={`w-full ${sizeClasses[size]} transform overflow-hidden rounded-lg bg-white dark:bg-slate-900 text-left align-middle shadow-xl transition-all`}>
                {children}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

const ModalHeader = ({ children, closeButton, onClose }) => (
  <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
    <div className="flex-1">
      {children}
    </div>
    {closeButton && (
      <button
        onClick={onClose}
        className="ml-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
      >
        <XMarkIcon className="w-6 h-6" />
      </button>
    )}
  </div>
);

const ModalTitle = ({ children }) => (
  <Dialog.Title className="text-lg font-medium text-slate-900 dark:text-slate-100">
    {children}
  </Dialog.Title>
);

const ModalBody = ({ children }) => (
  <div className="p-6 text-slate-900 dark:text-slate-100">
    {children}
  </div>
);

const ModalFooter = ({ children }) => (
  <div className="flex justify-end gap-3 p-6 border-t border-slate-200 dark:border-slate-700">
    {children}
  </div>
);

// Exports pour compatibilité avec la syntaxe Bootstrap
Modal.Header = ModalHeader;
Modal.Title = ModalTitle;
Modal.Body = ModalBody;
Modal.Footer = ModalFooter;

export default Modal; 