import { Switch as Primitive } from 'radix-ui';
import type { ComponentProps } from 'react';
export function Switch(props: ComponentProps<typeof Primitive.Root>) {
  return (
    <Primitive.Root className="switch" {...props}>
      <Primitive.Thumb className="switch-thumb" />
    </Primitive.Root>
  );
}
