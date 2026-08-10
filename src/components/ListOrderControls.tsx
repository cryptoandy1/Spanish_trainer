import type { ListOrder } from "../lib/listOrder";
import { ui } from "../lib/i18n";

/** Shuffle / restore-original buttons, shared by the word, phrase and verb lists. */
export function ListOrderControls<T>({ order }: { order: ListOrder<T> }) {
  return (
    <div className="list-order">
      <button type="button" className="btn" onClick={order.shuffle}>
        🔀 {order.shuffled ? ui.list.reshuffle : ui.list.shuffle}
      </button>
      {order.shuffled && (
        <button type="button" className="btn" onClick={order.restore}>
          {ui.list.restoreOrder}
        </button>
      )}
    </div>
  );
}
