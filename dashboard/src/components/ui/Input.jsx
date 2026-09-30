import { cn } from "../../lib/utils";
import styles from "../../styles/modules/ui/Input.module.scss";

// Ye native input ko shared styling deta hai aur baaki props forward karta hai.
export function Input({ className, type = "text", ...props }) {
    return (
        <input
            type={type}
            className={cn(styles.input, className)}
            {...props}
        />
    );
}
