import { auth } from '@/lib/firebase';
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import React, { forwardRef } from 'react';

// Ref interface for controlling the modal
export interface FirebaseRecaptchaModalRef {
  showModal: () => void;
}

interface Props {
  onSuccess?: (token: string) => void;
  onError?: (error: Error) => void;
}

/**
 * FirebaseRecaptchaModal
 * Wraps expo-firebase-recaptcha's modal for use in Expo phone auth
 * Can be controlled via ref to show/hide the reCAPTCHA widget
 */
const FirebaseRecaptchaModal = forwardRef<FirebaseRecaptchaModalRef, Props>(
  ({ onSuccess, onError }, ref) => {
    const recaptchaModalRef = React.useRef<FirebaseRecaptchaVerifierModal>(null);

    React.useImperativeHandle(ref, () => ({
      showModal: () => {
        recaptchaModalRef.current?.showModal?.();
      },
    }));

    return (
      <FirebaseRecaptchaVerifierModal
        ref={recaptchaModalRef}
        firebaseConfig={auth.app?.options}
        title="reCAPTCHA"
        message="Please complete the reCAPTCHA to continue"
        cancelLabel="Cancel"
      />
    );
  }
);

FirebaseRecaptchaModal.displayName = 'FirebaseRecaptchaModal';

export default FirebaseRecaptchaModal;
