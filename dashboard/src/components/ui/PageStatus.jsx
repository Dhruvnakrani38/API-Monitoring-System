import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from './Button';
import styles from '../../styles/modules/pages/PageComponents.module.scss';

// Ye component request ki loading, failure ya ready state ke hisab se view chunta hai.
export function PageStatus({ isLoading, error, onRetry, loadingText = 'Loading...', errorText = 'Failed to load data' }) {
    // Loading ke dauran spinner aur status text dikhaye.
    if (isLoading) {
        return (
            <div className={styles.loadingContainer}>
                <Loader2 aria-label={loadingText} />
                <p>{loadingText}</p>
            </div>
        );
    }

    // Failure par error message aur optional retry action dikhaye.
    if (error) {
        return (
            <div className={styles.errorContainer}>
                <div className={styles.errorIcon}>
                    <AlertCircle aria-hidden="true" />
                </div>
                <p className={styles.errorTitle}>{errorText}</p>
                <p className={styles.errorMessage}>Please check your connection and try again</p>
                {onRetry && <Button onClick={onRetry}>Retry</Button>}
            </div>
        );
    }

    return null;
}
