import clsx from "clsx";
import { motion } from "framer-motion";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
};

export function Button({ className, variant = "primary", ...rest }: ButtonProps) {
  const styles =
    variant === "primary"
      ? "bg-[#0056D2] text-white hover:bg-[#0A5BD8] border-[#0056D2]"
      : variant === "danger"
        ? "bg-red-600 text-white hover:bg-red-700 border-red-600"
        : "bg-white text-slate-900 hover:bg-slate-50 border-slate-200";

  return (
    <motion.button
      whileHover={{ scale: rest.disabled ? 1 : 1.015 }}
      whileTap={{ scale: rest.disabled ? 1 : 0.975 }}
      transition={{ duration: 0.12 }}
      {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}
      className={clsx(
        "inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#0056D2]/25 disabled:pointer-events-none disabled:opacity-50",
        styles,
        className
      )}
    />
  );
}
