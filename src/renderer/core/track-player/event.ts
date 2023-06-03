import { TrackPlayerEventParams } from "./enum";
import EventWrapper from "@/common/event-wrapper";

const trackPlayerEventsEmitter = new EventWrapper<TrackPlayerEventParams>();

export default trackPlayerEventsEmitter;