// src/renderer/components/A/index.tsx
import {shellUtil} from "@shared/utils/renderer";
import React from "react"; // 确保 React 被导入

export default function A(
    props: React.DetailedHTMLProps<
        React.AnchorHTMLAttributes<HTMLAnchorElement>,
        HTMLAnchorElement
    >
) {
    const { href, onClick, children, ...rest } = props;

    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        let shouldPreventDefault = false;

        if (href && href !== "#" && !href.toLowerCase().startsWith("javascript:")) {
            shellUtil.openExternal(href);
            shouldPreventDefault = true; 
        }

        if (onClick) {
            onClick(e);
        }
        
        if (shouldPreventDefault || !href || href === "#" || (href && href.toLowerCase().startsWith("javascript:"))) {
            if (!e.defaultPrevented) { 
                 e.preventDefault();
            }
        }
    };

    const displayHref = (href && href.toLowerCase().startsWith("javascript:")) ? "#" : (href || "#");

    return (
        <a
            {...rest}
            href={displayHref}
            onClick={handleClick}
        >
            {children}
        </a>
    );
}