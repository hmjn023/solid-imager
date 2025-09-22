import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "./ui/dialog";
import type { mediaSourceInfo } from "../lib/types";
import MediaSourceForm from "./MediaSourceForm";

interface MediaSourceModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSubmit: (data: mediaSourceInfo) => void;
	initialData?: mediaSourceInfo;
	title: string;
	description: string;
}

export default function MediaSourceModal(props: MediaSourceModalProps) {
	return (
		<Dialog open={props.isOpen} onOpenChange={props.onClose}>
			<DialogContent class="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>{props.title}</DialogTitle>
					<DialogDescription>{props.description}</DialogDescription>
				</DialogHeader>
				<MediaSourceForm
					initialData={props.initialData}
					onSubmit={props.onSubmit}
					onCancel={props.onClose}
				/>
			</DialogContent>
		</Dialog>
	);
}
