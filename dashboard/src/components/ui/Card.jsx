import { cn } from "../../lib/utils";
import styles from "../../styles/modules/ui/Card.module.scss";

// Ye outer wrapper hai jo card content ko shared surface style deta hai.
export function Card({ className, children, ...props }) {
    return (
        <div
            className={cn(styles.card, className)}
            {...props}
        >
            {children}
        </div>
    );
}

// Ye card ke title aur description wale header section ko render karta hai.
export function CardHeader({ className, children, ...props }) {
    return (
        <div
            className={cn(styles.cardHeader, className)}
            {...props}
        >
            {children}
        </div>
    );
}

// Ye card heading ko shared title typography ke saath render karta hai.
export function CardTitle({ className, children, ...props }) {
    return (
        <h3
            className={cn(styles.cardTitle, className)}
            {...props}
        >
            {children}
        </h3>
    );
}

// Ye card title ke neeche chhota explanatory text render karta hai.
export function CardDescription({ className, children, ...props }) {
    return (
        <p
            className={cn(styles.cardDescription, className)}
            {...props}
        >
            {children}
        </p>
    );
}

// Ye card ka primary content area spacing ke saath render karta hai.
export function CardContent({ className, children, ...props }) {
    return (
        <div className={cn(styles.cardContent, className)} {...props}>
            {children}
        </div>
    );
}

// Ye card ke bottom actions ya summary ke liye footer section deta hai.
export function CardFooter({ className, children, ...props }) {
    return (
        <div
            className={cn(styles.cardFooter, className)}
            {...props}
        >
            {children}
        </div>
    );
}
